/**
 * The sync server entry point.
 *
 * One process: the mailbox guard, the matchmaker and the store, behind one
 * port. It writes no log line, so the platform log holds no addresses and
 * no labels.
 */
import { createSyncServerFromEnv, listenDualStack, startupLines } from './server.mjs';
import { createSqliteQueueStore } from './store-sqlite.mjs';
import { createPocketBaseStore } from '../mailbox/guard.mjs';

const port = Number(process.env.PORT ?? 8080);
// The dual-stack wildcard. A platform that probes http://localhost/ from
// inside the container resolves to ::1 first, and a server that only binds
// 0.0.0.0 answers "connection refused" there. A host without IPv6 falls
// back to IPv4.
const host = process.env.HOST ?? '::';
const dataDir = process.env.DATA_DIR ?? '/data';
const file = process.env.DB_FILE ?? `${dataDir}/mailbox.db`;

/**
 * The store. A SQLite file is the default, because one file and one
 * process is the whole thing. A host that already runs PocketBase can
 * point the server at it instead.
 */
const store = process.env.PB_BASE_URL
  ? createPocketBaseStore({ baseUrl: process.env.PB_BASE_URL, token: process.env.PB_TOKEN ?? '' })
  : createSqliteQueueStore({ file });

const { server, guard } = createSyncServerFromEnv({
  ...process.env,
  store,
});

listenDualStack(server, port, host);

// One line at startup, so the operator can see where it is. After that the
// server is quiet: a request is never written down.
server.on('listening', () => {
  for (const line of startupLines(server)) console.log(line);
});

// The hourly purge, the same one the PocketBase guard does.
const purgeEveryMs = 60 * 60 * 1000;
const timer = setInterval(() => {
  guard.purge().catch(() => {});
}, purgeEveryMs);
timer.unref();

function shutdown() {
  server.close(() => {
    try {
      store.close?.();
    } catch {
      // The file is already closed.
    }
    process.exit(0);
  });
  // Do not wait forever for a connection that will not end.
  setTimeout(() => process.exit(0), 5000).unref();
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
