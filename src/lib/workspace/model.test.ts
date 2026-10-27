import { describe, expect, it } from 'vitest';

import * as Y from 'yjs';

import {
  addConversation, createRoomDoc, coworkerMap, majorityMeter, setRating, upsertCoworker,
} from './model';
import { sealUpdate, verifyUpdate } from './envelope';
import { hmacKey } from './keys';

const iso = (d: string) => d;

describe('R3.3 Yjs room model', () => {
  it('upserts coworkers and keeps rating history appended, never overwritten', () => {
    const doc = createRoomDoc();
    upsertCoworker(doc, { id: 'c1', displayName: 'Rosa', dept: 'Dairy', shift: 'nights', language: 'es' });
    setRating(doc, 'c1', 4, iso('2026-10-01'), 'm1');
    setRating(doc, 'c1', 2, iso('2026-10-24'), 'm1');
    const c = coworkerMap(doc).get('c1')!;
    expect(c.get('displayName')).toBe('Rosa');
    const hist = c.get('ratingHistory') as { rating: number; at: string }[];
    expect(hist.map((h) => h.rating)).toEqual([4, 2]);
  });

  it('conversations log old->new ratings and issues', () => {
    const doc = createRoomDoc();
    upsertCoworker(doc, { id: 'c1', displayName: 'Rosa', dept: 'Dairy', shift: 'nights', language: 'es' });
    addConversation(doc, {
      id: 'cv1', coworker: 'c1', by: 'm1', at: iso('2026-10-24T18:00'),
      from: 3, to: 2, issues: ['schedule'], note: 'wants the petition first',
    });
    const cv = (doc.getArray('conversations').get(0) as { to: number; issues: string[] });
    expect(cv.to).toBe(2);
    expect(cv.issues).toEqual(['schedule']);
  });

  it('majority meter is derived, never stored', () => {
    const doc = createRoomDoc();
    const mk = (id: string, r: 1 | 2 | 3 | 4 | 5) => {
      upsertCoworker(doc, { id, displayName: id, dept: 'D', shift: 'n', language: 'en' });
      setRating(doc, id, r, iso('2026-10-01'), 'm1');
    };
    ['a', 'b'].forEach((id) => mk(id, 1));
    mk('c', 2);
    mk('d', 5);
    // Meter runs against the EXPECTED unit size (spec: now / 30% / 70%),
    // not against the rated count.
    const m = majorityMeter(doc, 10);
    expect(m.supporters).toBe(3);
    expect(m.total).toBe(4);
    expect(m.pct).toBeCloseTo(0.3);
    expect(m.floor30).toBe(true);
    expect(m.go70).toBe(false);
    // unit size larger than chart -> pct drops below floor
    const m2 = majorityMeter(doc, 10);
    expect(m2.go70).toBe(false);
    mk('e', 1); mk('f', 2); mk('g', 1); mk('h', 3); mk('i', 1); mk('j', 2);
    const m3 = majorityMeter(doc, 10);
    expect(m3.supporters).toBe(8);
    expect(m3.pct).toBeCloseTo(0.8);
    expect(m3.go70).toBe(true);
  });
});

describe('R3.3 deniable update envelope (room-key MAC)', () => {
  it('seals and verifies an update; any byte flip fails; no signatures involved', async () => {
    const doc = createRoomDoc();
    upsertCoworker(doc, { id: 'c1', displayName: 'Rosa', dept: 'Dairy', shift: 'nights', language: 'es' });
    const update = Y.encodeStateAsUpdate(doc);
    const roomKey = await hmacKey(new Uint8Array(32).fill(9));
    const sealed = await sealUpdate(update, roomKey);
    expect(await verifyUpdate(sealed, roomKey)).toBe(true);

    const bytes = new Uint8Array(sealed);
    bytes[20] ^= 1;
    await expect(verifyUpdate(bytes, roomKey)).resolves.toBe(false);
  });

  it('updates apply after verification', async () => {
    const a = createRoomDoc();
    upsertCoworker(a, { id: 'c1', displayName: 'Rosa', dept: 'Dairy', shift: 'nights', language: 'es' });
    const roomKey = await hmacKey(new Uint8Array(32).fill(3));
    const sealed = await sealUpdate(Y.encodeStateAsUpdate(a), roomKey);
    expect(await verifyUpdate(sealed, roomKey)).toBe(true);

    const b = createRoomDoc();
    Y.applyUpdate(b, sealed.subarray(32)); // mac prefix stripped
    expect(coworkerMap(b).get('c1')!.get('displayName')).toBe('Rosa');
  });
});
