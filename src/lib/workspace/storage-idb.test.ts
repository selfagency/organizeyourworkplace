import { beforeEach, describe, expect, it } from 'vitest';
import 'fake-indexeddb/auto';

import { createIdbStore } from './storage';

/**
 * The IndexedDB adapter, against a real IndexedDB implementation. The
 * memory adapter is the same interface, so this is the part that can
 * break on its own.
 */
describe('R3.8 the IndexedDB adapter', () => {
  let dbName: string;

  beforeEach(() => {
    dbName = `test-${Math.random().toString(36).slice(2)}`;
  });

  it('stores and reads a value back', async () => {
    const store = createIdbStore(dbName);
    await store.set('a', { hello: 'world' });
    expect(await store.get('a')).toEqual({ hello: 'world' });
  });

  it('stores bytes the way the crypto envelope produces them', async () => {
    const store = createIdbStore(dbName);
    const blob = new Uint8Array([1, 2, 3, 250]).buffer;
    await store.set('sealed', blob);
    const back = await store.get<ArrayBuffer>('sealed');
    expect(new Uint8Array(back!)).toEqual(new Uint8Array([1, 2, 3, 250]));
  });

  it('lists the keys it holds', async () => {
    const store = createIdbStore(dbName);
    await store.set('one', 1);
    await store.set('two', 2);
    expect((await store.keys()).sort()).toEqual(['one', 'two']);
  });

  it('returns nothing for a key it never had', async () => {
    const store = createIdbStore(dbName);
    expect(await store.get('missing')).toBeUndefined();
  });

  it('clears everything', async () => {
    const store = createIdbStore(dbName);
    await store.set('one', 1);
    await store.set('two', 2);
    await store.wipe();
    expect(await store.keys()).toEqual([]);
  });

  it('keeps two databases apart', async () => {
    const first = createIdbStore(`${dbName}-a`);
    const second = createIdbStore(`${dbName}-b`);
    await first.set('x', 1);
    expect(await second.get('x')).toBeUndefined();
  });
});
