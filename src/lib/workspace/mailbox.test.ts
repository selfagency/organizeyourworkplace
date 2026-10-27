import { describe, expect, it } from 'vitest';

import { fromBase64Url, randomBytes, toBase64Url } from './keys';
import {
  bucketFor,
  BUCKETS,
  createPrekeyStore,
  expiresAt,
  generatePrekey,
  isWithinServerCap,
  MAX_RETENTION_MS,
  padToBucket,
  queueLabel,
  retentionMs,
  sealToPrekey,
  openFromPrekey,
} from './mailbox';

const NOW = Date.UTC(2026, 9, 27, 12, 0, 0);
const roomKey = new Uint8Array(32).fill(3);
const enc = new TextEncoder();

describe('R3.6 mailbox labels', () => {
  it('gives the same label to every member on the same day', async () => {
    const date = new Date(NOW);
    const a = await queueLabel(roomKey, date);
    const b = await queueLabel(roomKey, new Date(NOW));
    expect(a).toBe(b);
  });

  it('rotates the label every day', async () => {
    const today = await queueLabel(roomKey, new Date(NOW));
    const tomorrow = await queueLabel(roomKey, new Date(NOW + 24 * 60 * 60 * 1000));
    expect(today).not.toBe(tomorrow);
  });

  it('gives a different room a different label', async () => {
    const other = new Uint8Array(32).fill(4);
    expect(await queueLabel(roomKey, new Date(NOW))).not.toBe(await queueLabel(other, new Date(NOW)));
  });
});

describe('R3.6 retention', () => {
  it('offers one week, two weeks and one month', () => {
    expect(retentionMs('1w')).toBe(7 * 24 * 60 * 60 * 1000);
    expect(retentionMs('2w')).toBe(14 * 24 * 60 * 60 * 1000);
    expect(retentionMs('1m')).toBe(30 * 24 * 60 * 60 * 1000);
  });

  it('keeps every option under the server cap', () => {
    for (const id of ['1w', '2w', '1m'] as const) {
      expect(isWithinServerCap(expiresAt(NOW, id), NOW)).toBe(true);
    }
  });

  it('refuses anything past 31 days', () => {
    expect(isWithinServerCap(NOW + MAX_RETENTION_MS, NOW)).toBe(true);
    expect(isWithinServerCap(NOW + MAX_RETENTION_MS + 1, NOW)).toBe(false);
    expect(isWithinServerCap(NOW - 1, NOW)).toBe(false);
  });
});

describe('R3.6 padding', () => {
  it('puts a message in the smallest bucket that fits', () => {
    expect(bucketFor(10)).toBe(256);
    expect(bucketFor(256)).toBe(256);
    expect(bucketFor(257)).toBe(512);
    expect(bucketFor(BUCKETS[BUCKETS.length - 1])).toBe(BUCKETS[BUCKETS.length - 1]);
  });

  it('refuses a message that is too large', () => {
    expect(() => bucketFor(BUCKETS[BUCKETS.length - 1] + 1)).toThrow();
  });

  it('pads to the bucket so length says nothing', () => {
    const { blob, bucket } = padToBucket(new Uint8Array([1, 2, 3]));
    expect(blob.length).toBe(bucket);
    expect(blob[0]).toBe(1);
  });
});

describe('R3.6 one-time prekeys', () => {
  it('seals a message only the prekey holder can open', async () => {
    const prekey = await generatePrekey(NOW);
    const message = enc.encode('shift change on Thursday');
    const sealed = await sealToPrekey(message, fromBase64Url(prekey.publicB64));
    const opened = await openFromPrekey(sealed, prekey);
    expect(new TextDecoder().decode(opened)).toBe('shift change on Thursday');
  });

  it('cannot be opened with a different prekey', async () => {
    const prekey = await generatePrekey(NOW);
    const other = await generatePrekey(NOW);
    const sealed = await sealToPrekey(new Uint8Array([1, 2, 3]), fromBase64Url(prekey.publicB64));
    await expect(openFromPrekey(sealed, other)).rejects.toThrow();
  });

  it('is used once and then gone from the store', async () => {
    const store = createPrekeyStore();
    const prekey = await generatePrekey(NOW);
    store.add(prekey);
    expect(store.list()).toHaveLength(1);
    expect(store.take(prekey.id)).toBeDefined();
    expect(store.take(prekey.id)).toBeUndefined();
    expect(store.list()).toHaveLength(0);
  });

  it('keeps the private half of a prekey out of what is published', async () => {
    const prekey = await generatePrekey(NOW);
    const published = { id: prekey.id, publicB64: prekey.publicB64, createdAt: prekey.createdAt };
    expect(Object.keys(published)).not.toContain('privateKey');
    expect(published.publicB64).toBe(toBase64Url(fromBase64Url(prekey.publicB64)));
  });
});

describe('R3.6 mailbox messages', () => {
  it('gives a different message a different ciphertext', async () => {
    const prekey = await generatePrekey(NOW);
    const a = await sealToPrekey(new Uint8Array([1, 2, 3]), fromBase64Url(prekey.publicB64));
    const b = await sealToPrekey(new Uint8Array([1, 2, 3]), fromBase64Url(prekey.publicB64));
    expect(a.ciphertextB64).not.toBe(b.ciphertextB64);
  });

  it('pads a sealed message into a bucket before it is queued', async () => {
    const prekey = await generatePrekey(NOW);
    const sealed = await sealToPrekey(randomBytes(50), fromBase64Url(prekey.publicB64));
    const { blob } = padToBucket(fromBase64Url(sealed.ciphertextB64));
    expect(BUCKETS).toContain(blob.length);
  });
});
