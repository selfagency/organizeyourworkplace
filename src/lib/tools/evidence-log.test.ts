import { describe, expect, it } from 'vitest';

import {
  createChain, appendEntry, verifyChain, deriveKey, seal, open,
  exportTimeline, buildIcsDates, type Chain, type Entry,
} from './evidence-log';

const entry = {
  when: '2026-10-27T14:30',
  what: 'Supervisor threatened write-ups if we keep meeting',
  who: 'J. Smith (shift lead)',
  witnesses: 'M. Jones, R. Lee',
  files: [] as string[],
};

describe('T11 evidence log crypto', () => {
  it('creates a chain with a genesis hash', async () => {
    const c = await createChain();
    expect(c.entries).toHaveLength(0);
    expect(c.genesis).toMatch(/^[0-9a-f]{64}$/);
    expect(await verifyChain(c)).toBe(true);
  });

  it('append → verify passes; any edit breaks verification', async () => {
    let c: Chain = await createChain();
    c = await appendEntry(c, entry);
    c = await appendEntry(c, { ...entry, when: '2026-10-27T16:00' });
    expect(await verifyChain(c)).toBe(true);
    expect(c.entries[1].prev).toBe(c.entries[0].hash);

    const tampered: Chain = {
      ...c,
      entries: c.entries.map((e, i) => (i === 0 ? { ...e, what: 'backdated story' } : e)),
    };
    expect(await verifyChain(tampered)).toBe(false);

    const reordered: Chain = { ...c, entries: [c.entries[1], c.entries[0]] };
    expect(await verifyChain(reordered)).toBe(false);
  });

  it('seal/open round-trips; wrong passphrase fails; tampered blob fails', async () => {
    let c: Chain = await createChain();
    c = await appendEntry(c, entry);
    const key = await deriveKey('correct horse battery staple');
    const blob = await seal(c, key);
    expect(await open(blob, key).then((x) => x.entries)).toHaveLength(1);

    const wrong = await deriveKey('wrong passphrase');
    await expect(open(blob, wrong)).rejects.toThrow();

    const bytes = new Uint8Array(blob);
    bytes[bytes.length - 1] ^= 0xff; // flip a bit in the GCM tag
    await expect(open(bytes.buffer as ArrayBuffer, key)).rejects.toThrow();
  });

  it('export timeline is NLRB-ready text with every entry in order', async () => {
    let c: Chain = await createChain();
    c = await appendEntry(c, entry);
    c = await appendEntry(c, { ...entry, when: '2026-10-27T16:00', what: 'Fired' });
    const out = exportTimeline(c, 'en');
    expect(out).toContain('EVIDENCE TIMELINE');
    expect(out).toContain('2026-10-27 14:30');
    expect(out).toContain('Fired');
    expect(out.indexOf('14:30')).toBeLessThan(out.indexOf('16:00'));
    expect(out).toContain('chain verified');
  });

  it('ics dates come from entry timestamps', () => {
    const e: Entry = { ...entry, when: '2026-03-05T09:15', hash: 'x', prev: 'y' };
    expect(buildIcsDates([e])).toEqual(['20260305']);
  });
});
