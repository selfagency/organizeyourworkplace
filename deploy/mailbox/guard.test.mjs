import { describe, expect, it, vi } from 'vitest';

import { createGuardServer, createMailboxGuard, createMemoryQueueStore, LABEL_PATTERN, MAX_BLOB_CHARS, MAX_RETENTION_MS } from './guard.mjs';

const NOW = Date.UTC(2026, 9, 27, 12, 0, 0);
const LABEL = 'AbCdEfGhIjKlMnOpQrStUv';

function guardWith(overrides = {}) {
  let clock = NOW;
  const store = createMemoryQueueStore();
  const guard = createMailboxGuard({ store, now: () => clock, ...overrides });
  return { guard, store, tick: (ms) => { clock += ms; } };
}

describe('R3.6 mailbox guard', () => {
  it('takes a message that follows the rules', async () => {
    const { guard } = guardWith();
    const result = await guard.put({
      label: LABEL,
      blob: 'opaque-ciphertext',
      expiresAt: NOW + 14 * 24 * 60 * 60 * 1000,
      ip: '10.0.0.1',
    });
    expect(result.ok).toBe(true);
    expect(result.status).toBe(201);
  });

  it('refuses a label that is not a queue label', async () => {
    const { guard } = guardWith();
    const result = await guard.put({ label: 'short', blob: 'x', expiresAt: NOW + 1000, ip: '10.0.0.1' });
    expect(result.reason).toBe('bad-label');
    expect(LABEL_PATTERN.test(LABEL)).toBe(true);
  });

  it('refuses a blob over the size cap', async () => {
    const { guard } = guardWith();
    const result = await guard.put({
      label: LABEL,
      blob: 'x'.repeat(MAX_BLOB_CHARS + 1),
      expiresAt: NOW + 1000,
      ip: '10.0.0.1',
    });
    expect(result.reason).toBe('bad-blob');
  });

  it('refuses an expiry past 31 days', async () => {
    const { guard } = guardWith();
    const result = await guard.put({
      label: LABEL,
      blob: 'x',
      expiresAt: NOW + MAX_RETENTION_MS + 1,
      ip: '10.0.0.1',
    });
    expect(result.reason).toBe('bad-expiry');
  });

  it('refuses an expiry in the past', async () => {
    const { guard } = guardWith();
    const result = await guard.put({ label: LABEL, blob: 'x', expiresAt: NOW - 1, ip: '10.0.0.1' });
    expect(result.reason).toBe('bad-expiry');
  });

  it('rate limits one label', async () => {
    const { guard } = guardWith({ perLabelPerMinute: 2 });
    const send = () => guard.put({ label: LABEL, blob: 'x', expiresAt: NOW + 1000, ip: '10.0.0.1' });
    expect((await send()).ok).toBe(true);
    expect((await send()).ok).toBe(true);
    expect((await send()).reason).toBe('label-rate-limited');
  });

  it('hands a message back to the same label only', async () => {
    const { guard } = guardWith();
    await guard.put({ label: LABEL, blob: 'mine', expiresAt: NOW + 1000, ip: '10.0.0.1' });
    const mine = await guard.list({ label: LABEL, since: 0 });
    expect(mine.items).toHaveLength(1);
    expect(mine.items[0].blob).toBe('mine');
    const other = await guard.list({ label: 'ZzYyXxWwVvUuTtSsRrQqPp', since: 0 });
    expect(other.items).toHaveLength(0);
  });

  it('purges what expired', async () => {
    const { guard, tick } = guardWith();
    await guard.put({ label: LABEL, blob: 'old', expiresAt: NOW + 1000, ip: '10.0.0.1' });
    tick(2000);
    const purged = await guard.purge();
    expect(purged.removed).toBe(1);
    expect((await guard.list({ label: LABEL, since: 0 })).items).toHaveLength(0);
  });

  it('deletes a whole queue, which is what a removal does to the old room', async () => {
    const { guard } = guardWith();
    await guard.put({ label: LABEL, blob: 'one', expiresAt: NOW + 60_000, ip: '10.0.0.1' });
    await guard.put({ label: LABEL, blob: 'two', expiresAt: NOW + 60_000, ip: '10.0.0.2' });
    const deleted = await guard.delete({ label: LABEL });
    expect(deleted.removed).toBe(2);
    expect((await guard.list({ label: LABEL, since: 0 })).items).toHaveLength(0);
  });

  it('refuses to delete a queue without a queue label', async () => {
    const { guard } = guardWith();
    expect((await guard.delete({ label: 'nope' })).reason).toBe('bad-label');
  });
});

describe('R3.6 mailbox guard over HTTP', () => {
  it('serves a queue without writing a log line', async () => {
    const { guard } = guardWith();
    const server = createGuardServer(guard);
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    const port = server.address().port;
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      const put = await fetch(`http://127.0.0.1:${port}/queue`, {
        method: 'POST',
        body: JSON.stringify({ label: LABEL, blob: 'opaque', expires_at: NOW + 60_000 }),
      });
      expect(put.status).toBe(201);
      const pulled = await fetch(`http://127.0.0.1:${port}/queue?label=${LABEL}&since=0`).then((r) => r.json());
      expect(pulled.items).toHaveLength(1);
      expect(log).not.toHaveBeenCalled();
      expect(error).not.toHaveBeenCalled();
    } finally {
      log.mockRestore();
      error.mockRestore();
      await new Promise((resolve) => server.close(resolve));
    }
  });
});
