/**
 * Two devices through the real sync server (R3.9).
 *
 * The sync server in this repo is started on an ephemeral port, in this
 * process, and two clients are driven against it. This is the test the
 * browser walkthrough covered from outside; here it runs in CI, in node,
 * against the same server that ships in the image.
 *
 * What it proves: a change on one device reaches the other, the whole
 * change and not half of it, and a device does not apply its own echo.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import * as Y from 'yjs';

import { createSyncServer } from '../../../deploy/sync-server/server.mjs';
import { createMailboxGuard, createMemoryQueueStore } from '../../../deploy/mailbox/guard.mjs';
import { createMatchmaker } from '../../../deploy/matchmaker/server.mjs';
import { SyncClient } from './sync';
import { upsertCoworker, coworkerMap } from './model';

const ROOM_KEY = new Uint8Array(32).fill(9);

/** The guard and the matchmaker, wired the way main.mjs wires them. */
function buildServer() {
  return createSyncServer({
    guard: createMailboxGuard({ store: createMemoryQueueStore() }),
    matchmaker: createMatchmaker(),
  });
}

function makeClient(base: string, memberId: string, roomKey: Uint8Array): SyncClient {
  return new SyncClient({
    serverUrl: base,
    roomKey,
    memberId,
    pollMs: 250,
    debounceMs: 100,
  });
}

/** Waits until the probe is true, or gives up after five seconds. */
async function waitFor(probe: () => boolean): Promise<void> {
  const deadline = Date.now() + 5000;
  for (;;) {
    if (probe()) return;
    if (Date.now() > deadline) throw new Error('the change did not arrive in time');
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
}

describe('R3.9 two devices on the real sync server', () => {
  let base = '';
  const clients: SyncClient[] = [];
  const docs: Y.Doc[] = [];
  let closeServer: (() => Promise<void>) | null = null;

  beforeAll(async () => {
    const server = buildServer();
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()));
    const address = server.address();
    const port = address && typeof address !== 'string' ? address.port : 0;
    base = `http://127.0.0.1:${port}`;
    closeServer = () => new Promise((resolve) => server.close(() => resolve()));
  });

  afterAll(async () => {
    for (const client of clients) client.stop();
    if (closeServer) await closeServer();
  });

  function twoDocsWith(tier: string): { a: SyncClient; b: SyncClient; docA: Y.Doc; docB: Y.Doc } {
    const docA = new Y.Doc();
    const docB = new Y.Doc();
    // A room key per test, so the queue labels do not mix: the label comes
    // from the room key and the day, and two rooms on the same label would
    // read each other's history.
    const roomKey = new Uint8Array(32).fill(ROOM_KEY[0]! + tier.charCodeAt(0));
    const a = makeClient(base, `device-${tier}-a`, roomKey);
    const b = makeClient(base, `device-${tier}-b`, roomKey);
    clients.push(a, b);
    docs.push(docA, docB);
    return { a, b, docA, docB };
  }

  it('carries a change from one device to the other', async () => {
    const { a, b, docA, docB } = twoDocsWith('x');
    await a.start(docA);
    await b.start(docB);

    upsertCoworker(docA, {
      id: 'c-rosa',
      displayName: 'Rosa',
      dept: 'Dairy',
      shift: 'Nights',
      language: 'es',
    });
    await waitFor(() => coworkerMap(docB).get('c-rosa') !== undefined);
    const rosa = coworkerMap(docB).get('c-rosa') as Y.Map<unknown>;
    expect(rosa.get('displayName')).toBe('Rosa');
  });

  it('carries the whole change, not half of it', async () => {
    const { a, b, docA, docB } = twoDocsWith('y');
    await a.start(docA);
    await b.start(docB);

    // Two changes in a burst, inside one debounce window.
    upsertCoworker(docA, { id: 'c-ana', displayName: 'Ana', dept: 'Bakery', shift: 'Days', language: 'es' });
    upsertCoworker(docA, { id: 'c-ben', displayName: 'Ben', dept: 'Bakery', shift: 'Days', language: 'es' });
    await waitFor(() => {
      const ana = coworkerMap(docB).get('c-ana') as Y.Map<unknown> | undefined;
      const ben = coworkerMap(docB).get('c-ben') as Y.Map<unknown> | undefined;
      return ana !== undefined && ben !== undefined;
    });
    expect((coworkerMap(docB).get('c-ana') as Y.Map<unknown>).get('displayName')).toBe('Ana');
    expect((coworkerMap(docB).get('c-ben') as Y.Map<unknown>).get('displayName')).toBe('Ben');
  });

  it('does not apply the device its own echo', async () => {
    const { a, b, docA, docB } = twoDocsWith('z');
    await a.start(docA);
    await b.start(docB);

    upsertCoworker(docA, { id: 'c-dev', displayName: 'Dev', dept: 'Dairy', shift: 'Nights', language: 'en' });
    await waitFor(() => coworkerMap(docB).get('c-dev') !== undefined);
    // What device A has, device B has, and no third copy appeared.
    expect(coworkerMap(docA).size).toBe(1);
    expect(coworkerMap(docB).size).toBe(1);
  });
});