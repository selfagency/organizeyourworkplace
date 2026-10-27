import { describe, expect, it, vi } from 'vitest';

import * as Y from 'yjs';

import { deriveSyncKey, openUpdate, sealUpdate } from './sync';

const ROOM_KEY = new Uint8Array(32).fill(9);

describe('R3.9 the sync envelope', () => {
  it('seals an update and opens it again', async () => {
    const key = await deriveSyncKey(ROOM_KEY);
    const update = new Uint8Array([1, 2, 3, 4]);
    const blob = await sealUpdate(key, update, 'maria');
    const opened = await openUpdate(key, blob);
    expect(opened.from).toBe('maria');
    expect(opened.update).toEqual(update);
  });

  it('cannot be opened with another room key', async () => {
    const key = await deriveSyncKey(ROOM_KEY);
    const other = await deriveSyncKey(new Uint8Array(32).fill(8));
    const blob = await sealUpdate(key, new Uint8Array([1, 2, 3]), 'maria');
    await expect(openUpdate(other, blob)).rejects.toThrow();
  });

  it('gives a different blob every time', async () => {
    const key = await deriveSyncKey(ROOM_KEY);
    const a = await sealUpdate(key, new Uint8Array([1]), 'maria');
    const b = await sealUpdate(key, new Uint8Array([1]), 'maria');
    expect(a).not.toBe(b);
  });

  it('keeps the update out of the blob', async () => {
    const key = await deriveSyncKey(ROOM_KEY);
    const blob = await sealUpdate(key, new TextEncoder().encode('Rosa'), 'maria');
    expect(atob(blob)).not.toContain('Rosa');
  });
});

describe('R3.9 the sync client', () => {
  it('pushes a change and pulls it into the other document', async () => {
    const { SyncClient } = await import('./sync');
    const key = await deriveSyncKey(ROOM_KEY);
    const posted: { label: string; blob: string }[] = [];
    const server = vi.fn(async (url: string, init?: RequestInit) => {
      if (init?.method === 'POST') {
        const body = JSON.parse(String(init.body)) as { label: string; blob: string };
        posted.push(body);
        return new Response('{"ok":true}', { status: 201 });
      }
      const since = new URL(url).searchParams.get('since');
      const items = since === '0' ? posted.map((row) => ({ blob: row.blob, seq: 1 })) : [];
      return new Response(JSON.stringify({ items }), { status: 200 });
    });

    const local = new Y.Doc();
    local.getMap('coworkers').set('c1', 'Rosa');
    const remote = new Y.Doc();

    const localClient = new SyncClient({
      serverUrl: 'https://sync.example.org',
      roomKey: ROOM_KEY,
      memberId: 'maria',
      fetchImpl: server as unknown as typeof fetch,
      pollMs: 100_000,
      debounceMs: 1,
    });
    const remoteClient = new SyncClient({
      serverUrl: 'https://sync.example.org',
      roomKey: ROOM_KEY,
      memberId: 'sam',
      fetchImpl: server as unknown as typeof fetch,
      pollMs: 100_000,
      debounceMs: 1,
    });

    await localClient.start(local);
    await remoteClient.start(remote);
    await new Promise((resolve) => setTimeout(resolve, 20));
    await remoteClient.pull(remote);

    expect(posted.length).toBeGreaterThan(0);
    expect(remote.getMap('coworkers').get('c1')).toBe('Rosa');
    localClient.stop();
    remoteClient.stop();
    expect(key).toBeTruthy();
  });

  it('uses a queue label that comes from the room key', async () => {
    const { SyncClient } = await import('./sync');
    const seen: string[] = [];
    const server = vi.fn(async (url: string, init?: RequestInit) => {
      if (init?.method === 'POST') {
        seen.push((JSON.parse(String(init.body)) as { label: string }).label);
      }
      return new Response('{"ok":true}', { status: 201 });
    });
    const client = new SyncClient({
      serverUrl: 'https://sync.example.org',
      roomKey: ROOM_KEY,
      memberId: 'maria',
      fetchImpl: server as unknown as typeof fetch,
      pollMs: 100_000,
      debounceMs: 1,
    });
    const doc = new Y.Doc();
    doc.getMap('coworkers').set('c1', 'Rosa');
    await client.start(doc);
    await new Promise((resolve) => setTimeout(resolve, 20));
    client.stop();
    expect(seen[0]).toMatch(/^[A-Za-z0-9_-]{22}$/);
  });

  it('merges the changes that pile up before it sends them', async () => {
    const { SyncClient } = await import('./sync');
    const posted: string[] = [];
    const server = vi.fn(async (_url: string, init?: RequestInit) => {
      if (init?.method === 'POST') {
        posted.push((JSON.parse(String(init.body)) as { blob: string }).blob);
      }
      return new Response('{"ok":true}', { status: 201 });
    });
    const client = new SyncClient({
      serverUrl: 'https://sync.example.org',
      roomKey: ROOM_KEY,
      memberId: 'maria',
      fetchImpl: server as unknown as typeof fetch,
      pollMs: 100_000,
      debounceMs: 20,
    });
    const doc = new Y.Doc();
    await client.start(doc);
    const before = posted.length;
    // A coworker is several changes: the map, then the fields.
    const coworkers = doc.getMap('coworkers');
    const card = new Y.Map<unknown>();
    coworkers.set('c1', card);
    card.set('displayName', 'Rosa');
    card.set('dept', 'Dairy');
    await new Promise((resolve) => setTimeout(resolve, 80));
    client.stop();
    // One push, not three.
    expect(posted.length - before).toBe(1);
    const key = await deriveSyncKey(ROOM_KEY);
    const { update } = await openUpdate(key, posted[posted.length - 1]!);
    const other = new Y.Doc();
    Y.applyUpdate(other, update);
    expect(other.getMap('coworkers').get('c1')).toBeTruthy();
  });

  it('reports when the server is not there', async () => {
    const { SyncClient } = await import('./sync');
    const client = new SyncClient({
      serverUrl: 'https://sync.example.org',
      roomKey: ROOM_KEY,
      memberId: 'maria',
      fetchImpl: (async () => {
        throw new Error('no server');
      }) as unknown as typeof fetch,
      pollMs: 100_000,
    });
    const doc = new Y.Doc();
    await client.start(doc);
    expect(client.status.connected).toBe(false);
    expect(client.status.problem).toBe('no server');
    client.stop();
  });
});
