/**
 * R3.6 mailbox guard (05-security §Mailbox, 07-stack-and-hosting P7-P9).
 *
 * The guard is the only public door to the mailbox. PocketBase itself is not
 * reachable from outside, so the rules live here, in code that can be
 * tested: a message expires inside 31 days, a blob fits the size cap, a
 * label does not flood, and expired rows are purged every hour.
 *
 * Nothing here logs. The server sees a label, a size, a time and an
 * address it never writes down.
 */
import { createServer } from 'node:http';

export const MAX_RETENTION_MS = 31 * 24 * 60 * 60 * 1000;
/** The largest padded bucket (65536 bytes) in base64, plus room for the envelope. */
export const MAX_BLOB_CHARS = 90_000;
export const LABEL_PATTERN = /^[A-Za-z0-9_-]{22}$/;

export const DEFAULT_PER_LABEL_PER_MINUTE = 60;
export const DEFAULT_PER_IP_PER_MINUTE = 120;

export function createMemoryQueueStore() {
  const rows = new Map();
  const counters = new Map();
  return {
    async put(row) {
      const seq = row.seq;
      rows.set(`${row.label}:${seq}`, { ...row, id: `${seq}` });
      counters.set(row.label, Math.max(counters.get(row.label) ?? 0, seq));
      return { id: `${seq}`, seq };
    },
    async list(label, since) {
      return [...rows.values()]
        .filter((row) => row.label === label && row.seq > since)
        .sort((a, b) => a.seq - b.seq)
        .map((row) => ({ id: row.id, blob: row.blob, expires_at: row.expiresAt, seq: row.seq }));
    },
    async maxSeq(label) {
      return counters.get(label) ?? 0;
    },
    async deleteLabel(label) {
      let removed = 0;
      for (const [id, row] of rows) {
        if (row.label === label) {
          rows.delete(id);
          removed += 1;
        }
      }
      return removed;
    },
    async purgeExpired(now) {
      let removed = 0;
      for (const [id, row] of rows) {
        if (row.expiresAt <= now) {
          rows.delete(id);
          removed += 1;
        }
      }
      return removed;
    },
    async vacuum() {
      return 0;
    },
  };
}

/** PocketBase wants "YYYY-MM-DD HH:MM:SS.mmmZ", not the ISO form with a T. */
export function pbDate(ms) {
  return new Date(ms).toISOString().replace('T', ' ').replace('Z', 'Z');
}

/**
 * The store that talks to PocketBase. One collection, `queue`, with the
 * fields label, blob and expires_at, and no relations (P7).
 */
export function createPocketBaseStore({ baseUrl, token, collection = 'queue' }) {
  const headers = { 'content-type': 'application/json', authorization: token };
  return {
    async put(row) {
      const response = await fetch(`${baseUrl}/api/collections/${collection}/records`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          label: row.label,
          blob: row.blob,
          expires_at: pbDate(row.expiresAt),
          seq: row.seq,
        }),
      });
      if (!response.ok) {
        throw new Error(`mailbox store put failed: ${response.status} ${await response.text()}`);
      }
      return response.json();
    },
    async list(label, since) {
      const filter = `label = "${label}" && seq > ${since}`;
      const response = await fetch(
        `${baseUrl}/api/collections/${collection}/records?filter=${encodeURIComponent(filter)}&sort=seq`,
        { headers },
      );
      if (!response.ok) throw new Error(`mailbox store list failed: ${response.status}`);
      const body = await response.json();
      return (body.items ?? []).map((item) => ({
        id: item.id,
        blob: item.blob,
        expires_at: item.expires_at,
        seq: item.seq,
      }));
    },
    async maxSeq(label) {
      const filter = `label = "${label}"`;
      const response = await fetch(
        `${baseUrl}/api/collections/${collection}/records?filter=${encodeURIComponent(filter)}&sort=-seq&perPage=1`,
        { headers },
      );
      if (!response.ok) throw new Error(`mailbox store maxSeq failed: ${response.status}`);
      const body = await response.json();
      return body.items?.[0]?.seq ?? 0;
    },
    async deleteLabel(label) {
      const filter = `label = "${label}"`;
      const response = await fetch(
        `${baseUrl}/api/collections/${collection}/records?filter=${encodeURIComponent(filter)}&perPage=200`,
        { headers },
      );
      if (!response.ok) throw new Error(`mailbox store delete failed: ${response.status}`);
      const body = await response.json();
      let removed = 0;
      for (const item of body.items ?? []) {
        const deleted = await fetch(`${baseUrl}/api/collections/${collection}/records/${item.id}`, {
          method: 'DELETE',
          headers,
        });
        if (deleted.ok) removed += 1;
      }
      return removed;
    },
    async purgeExpired(now) {
      const response = await fetch(
        `${baseUrl}/api/collections/${collection}/records?filter=${encodeURIComponent(`expires_at < "${pbDate(now)}"`)}`,
        { headers },
      );
      if (!response.ok) throw new Error(`mailbox store purge failed: ${response.status}`);
      const body = await response.json();
      let removed = 0;
      for (const item of body.items ?? []) {
        const deleted = await fetch(`${baseUrl}/api/collections/${collection}/records/${item.id}`, {
          method: 'DELETE',
          headers,
        });
        if (deleted.ok) removed += 1;
      }
      return removed;
    },
    async vacuum() {
      // PocketBase is SQLite in a container, so the file-level VACUUM is a
      // host step. See runbook.md §Upgrade steps.
      return 0;
    },
  };
}

export function createMailboxGuard(options = {}) {
  const store = options.store ?? createMemoryQueueStore();
  const now = options.now ?? (() => Date.now());
  const perLabelPerMinute = options.perLabelPerMinute ?? DEFAULT_PER_LABEL_PER_MINUTE;
  const perIpPerMinute = options.perIpPerMinute ?? DEFAULT_PER_IP_PER_MINUTE;
  const labelStamps = new Map();
  const ipStamps = new Map();
  /** Last sequence number handed out per label. The guard is the only writer. */
  const counters = new Map();

  /**
   * The next sequence number for a label. One writer, so one counter, and it
   * is exact. A second guard replica would need a shared counter; that is
   * the one place to change if the guard ever runs twice.
   */
  const nextSeq = async (label) => {
    if (!counters.has(label)) {
      counters.set(label, await store.maxSeq(label));
    }
    const next = (counters.get(label) ?? 0) + 1;
    counters.set(label, next);
    return next;
  };

  const prune = (map) => {
    const cutoff = now() - 60_000;
    for (const [key, stamps] of map) {
      const kept = stamps.filter((stamp) => stamp > cutoff);
      if (kept.length === 0) map.delete(key);
      else map.set(key, kept);
    }
  };

  const overLimit = (map, key, limit) => {
    const stamps = map.get(key) ?? [];
    if (stamps.length >= limit) return true;
    stamps.push(now());
    map.set(key, stamps);
    return false;
  };

  return {
    async put({ label, blob, expiresAt, ip }) {
      if (typeof label !== 'string' || !LABEL_PATTERN.test(label)) {
        return { ok: false, status: 400, reason: 'bad-label' };
      }
      if (typeof blob !== 'string' || blob.length === 0 || blob.length > MAX_BLOB_CHARS) {
        return { ok: false, status: 413, reason: 'bad-blob' };
      }
      if (!Number.isSafeInteger(expiresAt) || expiresAt <= now() || expiresAt - now() > MAX_RETENTION_MS) {
        return { ok: false, status: 400, reason: 'bad-expiry' };
      }
      prune(labelStamps);
      prune(ipStamps);
      if (overLimit(labelStamps, label, perLabelPerMinute)) {
        return { ok: false, status: 429, reason: 'label-rate-limited' };
      }
      if (overLimit(ipStamps, ip ?? 'unknown', perIpPerMinute)) {
        return { ok: false, status: 429, reason: 'ip-rate-limited' };
      }
      const stored = await store.put({ label, blob, expiresAt, seq: await nextSeq(label) });
      return { ok: true, status: 201, id: stored.id, expires_at: expiresAt, seq: stored.seq };
    },

    async list({ label, since }) {
      if (typeof label !== 'string' || !LABEL_PATTERN.test(label)) {
        return { ok: false, status: 400, reason: 'bad-label' };
      }
      const items = await store.list(label, Number.isSafeInteger(since) && since >= 0 ? since : 0);
      return { ok: true, status: 200, items };
    },

    async delete({ label }) {
      if (typeof label !== 'string' || !LABEL_PATTERN.test(label)) {
        return { ok: false, status: 400, reason: 'bad-label' };
      }
      const removed = await store.deleteLabel(label);
      counters.delete(label);
      return { ok: true, status: 200, removed };
    },

    async purge() {
      const removed = await store.purgeExpired(now());
      await store.vacuum();
      return { ok: true, removed };
    },
  };
}

function readJson(request) {
  return new Promise((resolve, reject) => {
    let body = '';
    request.on('data', (chunk) => {
      body += chunk;
      if (body.length > MAX_BLOB_CHARS + 4096) reject(new Error('too large'));
    });
    request.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch {
        reject(new Error('bad json'));
      }
    });
    request.on('error', reject);
  });
}

function send(response, status, payload) {
  response.writeHead(status, {
    'content-type': 'application/json',
    'cache-control': 'no-store',
    'referrer-policy': 'no-referrer',
  });
  response.end(JSON.stringify(payload));
}

export function createGuardServer(guard) {
  return createServer(async (request, response) => {
    const url = new URL(request.url, 'https://mbx.invalid');
    const ip = request.socket.remoteAddress ?? 'unknown';
    try {
      if (request.method === 'POST' && url.pathname === '/queue') {
        const body = await readJson(request);
        const result = await guard.put({
          label: body.label,
          blob: body.blob,
          expiresAt: body.expires_at,
          ip,
        });
        send(response, result.status, result);
        return;
      }
      if (request.method === 'GET' && url.pathname === '/queue') {
        const result = await guard.list({
          label: url.searchParams.get('label') ?? '',
          since: Number(url.searchParams.get('since') ?? '0'),
        });
        send(response, result.status, result);
        return;
      }
      if (request.method === 'DELETE' && url.pathname === '/queue') {
        const result = await guard.delete({ label: url.searchParams.get('label') ?? '' });
        send(response, result.status, result);
        return;
      }
      if (request.method === 'GET' && url.pathname === '/health') {
        send(response, 200, { ok: true });
        return;
      }
      send(response, 404, { ok: false, reason: 'not-found' });
    } catch {
      send(response, 400, { ok: false, reason: 'bad-request' });
    }
  });
}
