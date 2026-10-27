/**
 * The sync server: one process, one port (R3.9).
 *
 * Three doors behind one port:
 *   /mailbox/queue   the encrypted queue, through the guard
 *   /match/*         the signaling matchmaker, which holds nothing
 *   /health          the health check
 *
 * The server never opens a blob. What it stores is ciphertext the members
 * sealed with the room key, and what it forwards is the same. A breach of
 * this process gives an attacker the labels, the sizes and the timing, and
 * nothing else.
 */
import { createServer } from 'node:http';

import { createGuardHandler, createMailboxGuard } from '../mailbox/guard.mjs';
import { createMatchmaker, createMatchmakerHandler } from '../matchmaker/server.mjs';

/** Paths that the health check and the platform use. */
const HEALTH_PATHS = new Set(['/health', '/healthz']);

/**
 * The app runs on a different site than the sync server, so the browser
 * asks the server first. The server holds no readable data: the queue
 * label is the capability, and a request without it gets nothing. A host
 * that wants to be stricter sets ALLOWED_ORIGINS to its own sites.
 */
export function corsHeaders(request, allowedOrigins = '*') {
  const origin = request.headers.origin;
  if (!origin) return {};
  const allowed =
    allowedOrigins === '*'
      ? '*'
      : allowedOrigins
          .split(',')
          .map((entry) => entry.trim())
          .filter(Boolean)
          .includes(origin)
        ? origin
        : null;
  if (!allowed) return {};
  return {
    'access-control-allow-origin': allowed,
    'access-control-allow-methods': 'GET, POST, DELETE, OPTIONS',
    'access-control-allow-headers': 'content-type',
    'access-control-max-age': '600',
  };
}

export function createSyncServer({ guard, matchmaker, allowedOrigins = '*' }) {
  const guardHandler = createGuardHandler(guard);
  const matchHandler = createMatchmakerHandler(matchmaker);

  return createServer(async (request, response) => {
    const url = new URL(request.url ?? '/', 'https://sync.invalid');
    const path = url.pathname;

    for (const [name, value] of Object.entries(corsHeaders(request, allowedOrigins))) {
      response.setHeader(name, value);
    }

    if (request.method === 'OPTIONS') {
      response.writeHead(204);
      response.end();
      return;
    }

    if (HEALTH_PATHS.has(path)) {
      response.writeHead(200, { 'content-type': 'application/json' });
      response.end(JSON.stringify({ ok: true }));
      return;
    }

    if (path === '/mailbox' || path.startsWith('/mailbox/')) {
      // The guard answers on /queue and /health. The query string stays.
      request.url = `${path.slice('/mailbox'.length) || '/'}${url.search}`;
      await guardHandler(request, response);
      return;
    }

    if (path === '/match' || path.startsWith('/match/')) {
      request.url = `${path.slice('/match'.length) || '/'}${url.search}`;
      await matchHandler(request, response);
      return;
    }

    response.writeHead(404, { 'content-type': 'application/json' });
    response.end(JSON.stringify({ ok: false, reason: 'not-found' }));
  });
}

/**
 * Listens on the dual-stack wildcard, so a probe to localhost works from
 * inside the container (it resolves to ::1 first) and the published IPv4
 * port still reaches it. A host without IPv6 falls back to IPv4.
 */
export function listenDualStack(server, port, host = '::') {
  server.on('error', (error) => {
    if (host === '::' && (error.code === 'EAFNOSUPPORT' || error.code === 'EADDRNOTAVAIL')) {
      server.listen(port, '0.0.0.0');
      return;
    }
    throw error;
  });
  server.listen(port, host);
  return server;
}

/** The pieces, from the environment. */
export function createSyncServerFromEnv(env = process.env) {
  const guard = createMailboxGuard({
    store: env.store,
    perLabelPerMinute: Number(env.PER_LABEL_PER_MINUTE ?? 60),
    perIpPerMinute: Number(env.PER_IP_PER_MINUTE ?? 120),
  });
  const matchmaker = createMatchmaker({
    powDifficulty: Number(env.POW_DIFFICULTY ?? 4),
    maxPeers: Number(env.MAX_PEERS ?? 8),
    joinsPerMinute: Number(env.JOINS_PER_MINUTE ?? 10),
    queueLimit: Number(env.QUEUE_LIMIT ?? 200),
  });
  return {
    server: createSyncServer({ guard, matchmaker, allowedOrigins: env.ALLOWED_ORIGINS ?? '*' }),
    guard,
    matchmaker,
  };
}
