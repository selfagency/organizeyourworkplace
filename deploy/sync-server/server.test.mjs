/**
 * The sync server, end to end, against a real SQLite file.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { createSyncServer, listenDualStack, startupLines } from './server.mjs';
import { createSqliteQueueStore } from './store-sqlite.mjs';
import { createMailboxGuard, createMemoryQueueStore } from '../mailbox/guard.mjs';
import { createMatchmaker } from '../matchmaker/server.mjs';

const LABEL = 'AbCdEfGhIjKlMnOpQrStUv';

let dir;
let store;
let base;

beforeEach(async () => {
  dir = mkdtempSync(join(tmpdir(), 'oyw-sync-'));
  store = createSqliteQueueStore({ file: join(dir, 'mailbox.db') });
  const guard = createMailboxGuard({ store });
  const matchmaker = createMatchmaker({ powDifficulty: 1 });
  const server = createSyncServer({ guard, matchmaker });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  base = `http://127.0.0.1:${address.port}`;
});

afterEach(() => {
  store.close();
  rmSync(dir, { recursive: true, force: true });
});

describe('R3.9 the sync server', () => {
  it('says where it is when it starts', async () => {
    const guard = createMailboxGuard({ store: createMemoryQueueStore() });
    const server = createSyncServer({ guard, matchmaker: createMatchmaker({ powDifficulty: 1 }) });
    await new Promise((resolve) => listenDualStack(server, 0, '::').once('listening', resolve));
    const lines = startupLines(server);
    const first = lines[0];
    expect(first).toMatch(/^sync server listening on port \d+/);
    expect(lines.join('\n')).toContain('health: /health');
    server.close();
  });

  it('answers on the loopback name, not just on the address', async () => {
    // A platform that probes http://localhost/ from inside the container
    // resolves to ::1 first. A server that only binds IPv4 answers
    // "connection refused" there, and the deploy looks broken.
    const guard = createMailboxGuard({ store: createMemoryQueueStore() });
    const server = createSyncServer({ guard, matchmaker: createMatchmaker({ powDifficulty: 1 }) });
    await new Promise((resolve) => listenDualStack(server, 0, '::').once('listening', resolve));
    const { port } = server.address();
    const response = await fetch(`http://localhost:${port}/health`);
    expect(response.status).toBe(200);
    server.close();
  });
  it('answers the health check', async () => {
    const response = await fetch(`${base}/health`);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true });
  });

  it('takes a blob on the mailbox door', async () => {
    const response = await fetch(`${base}/mailbox/queue`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ label: LABEL, blob: 'ciphertext', expires_at: Date.now() + 60_000 }),
    });
    expect(response.status).toBe(201);
    const body = await response.json();
    expect(body.ok).toBe(true);
    expect(body.seq).toBe(1);
  });

  it('hands the blob back on the same door', async () => {
    await fetch(`${base}/mailbox/queue`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ label: LABEL, blob: 'ciphertext', expires_at: Date.now() + 60_000 }),
    });
    const response = await fetch(`${base}/mailbox/queue?label=${LABEL}&since=0`);
    const body = await response.json();
    expect(body.items).toHaveLength(1);
    expect(body.items[0].blob).toBe('ciphertext');
  });

  it('refuses a blob that is too big', async () => {
    const response = await fetch(`${base}/mailbox/queue`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        label: LABEL,
        blob: 'x'.repeat(92_000),
        expires_at: Date.now() + 60_000,
      }),
    });
    expect(response.status).toBe(413);
  });

  it('refuses a label that is not a queue label', async () => {
    const response = await fetch(`${base}/mailbox/queue`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ label: 'nope', blob: 'ciphertext', expires_at: Date.now() + 60_000 }),
    });
    expect(response.status).toBe(400);
  });

  it('deletes a whole queue', async () => {
    await fetch(`${base}/mailbox/queue`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ label: LABEL, blob: 'ciphertext', expires_at: Date.now() + 60_000 }),
    });
    const response = await fetch(`${base}/mailbox/queue?label=${LABEL}`, { method: 'DELETE' });
    const body = await response.json();
    expect(body.removed).toBe(1);
  });

  it('serves the matchmaker on its own door', async () => {
    const response = await fetch(`${base}/match/challenge`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ room: 'room-000000000001' }),
    });
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.challenge).toBeTruthy();
  });

  it('answers 404 for anything else', async () => {
    const response = await fetch(`${base}/whatever`);
    expect(response.status).toBe(404);
  });

  it('lets a browser on another site ask', async () => {
    const response = await fetch(`${base}/health`, {
      headers: { origin: 'https://organizeyourworkplace.com' },
    });
    expect(response.headers.get('access-control-allow-origin')).toBe('*');
  });

  it('answers the browser preflight', async () => {
    const response = await fetch(`${base}/mailbox/queue`, {
      method: 'OPTIONS',
      headers: { origin: 'https://organizeyourworkplace.com' },
    });
    expect(response.status).toBe(204);
    expect(response.headers.get('access-control-allow-methods')).toContain('POST');
  });

  it('keeps the rows in a file, so the data survives a restart', async () => {    const file = join(dir, 'mailbox.db');
    await fetch(`${base}/mailbox/queue`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ label: LABEL, blob: 'ciphertext', expires_at: Date.now() + 60_000 }),
    });
    const reopened = createSqliteQueueStore({ file });
    const rows = await reopened.list(LABEL, 0);
    expect(rows).toHaveLength(1);
    expect(rows[0].blob).toBe('ciphertext');
    reopened.close();
  });
});
