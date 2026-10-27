/**
 * The one sync client this device runs.
 *
 * The shell starts it when the app opens and stops it when the app locks.
 * The members screen reads its status and can point the app at another
 * server.
 */
import { readSyncServer, resumeSession } from '../../lib/workspace/app-state';
import { SyncClient, type SyncStatus } from '../../lib/workspace/sync';

let client: SyncClient | null = null;
const listeners = new Set<(status: SyncStatus) => void>();

function publish(): void {
  if (!client) return;
  for (const listener of listeners) listener(client.status);
}

/** Starts the client if there is a server and no client yet. */
export async function startSync(): Promise<SyncClient | null> {
  const serverUrl = readSyncServer();
  if (!serverUrl || client) return client;
  const session = await resumeSession();
  if (!session) return null;
  client = new SyncClient({
    serverUrl,
    roomKey: session.roomKey,
    memberId: session.memberId,
    onApplied: () => {
      // Keep the changes on the device, so a reload does not lose them.
      void session.save();
    },
  });
  await client.start(session.doc);
  publish();
  const timer = setInterval(publish, 10_000);
  timer.unref?.();
  // Coming back to the app, pull right away instead of waiting for the
  // next tick.
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') void client?.pull(session.doc);
  });
  return client;
}

/** Stops the client. The app calls this when it locks. */
export function stopSync(): void {
  client?.stop();
  client = null;
  publish();
}

/** The current status, or null when there is no client. */
export function syncStatus(): SyncStatus | null {
  return client?.status ?? null;
}

/** Watches the status. Returns a function to stop watching. */
export function onSyncStatus(handler: (status: SyncStatus) => void): () => void {
  listeners.add(handler);
  return () => listeners.delete(handler);
}
