import { describe, expect, it } from 'vitest';

import { createMemoryStore, type KvStore } from './storage';
import { deriveKey, openJson, sealJson } from './crypto';

/**
 * R3.2 storage-layer tests run against the memory adapter; the IndexedDB
 * adapter is a thin browser wrapper over the same interface.
 */
describe('R3.2 encrypted storage', () => {
  it('stores and returns sealed blobs opaquely', async () => {
    const store = createMemoryStore();
    const key = await deriveKey('passphrase-1');
    const chain = { genesis: 'g', entries: [] };
    await store.set('sealed', await sealJson(chain, key));
    const blob = await store.get<ArrayBuffer>('sealed');
    expect(blob).toBeInstanceOf(ArrayBuffer);
    expect(await openJson(blob!, key)).toEqual(chain);
  });

  it('survives adapter restart only with the same passphrase', async () => {
    const a = createMemoryStore();
    const key = await deriveKey('right', new Uint8Array(16).fill(7));
    await a.set('sealed', await sealJson({ genesis: 'g', entries: [] }, key));
    const b = a; // simulating reopen with same backing data
    const wrong = await deriveKey('wrong', new Uint8Array(16).fill(7));
    await expect(openJson((await b.get<ArrayBuffer>('sealed'))!, wrong)).rejects.toThrow();
  });

  it('panic wipe clears every key', async () => {
    const store = createMemoryStore();
    await store.set('sealed', new ArrayBuffer(8));
    await store.set('salt', [1, 2, 3]);
    await store.wipe();
    expect(await store.get('sealed')).toBeUndefined();
    expect(await store.get('salt')).toBeUndefined();
    expect(await store.keys()).toEqual([]);
  });
});
