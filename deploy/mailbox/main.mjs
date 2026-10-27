/**
 * R3.6 mailbox guard entry point (05-security §Mailbox, P7-P9).
 *
 * The guard is the only public door to the mailbox. It validates what the
 * client sends, stores it in PocketBase, and purges what expired every
 * hour. It writes no log line.
 */
import { createGuardServer, createMailboxGuard, createPocketBaseStore } from './guard.mjs';

const port = Number(process.env.PORT ?? 8080);
const baseUrl = process.env.PB_BASE_URL ?? 'http://mbx:8090';
const token = process.env.PB_TOKEN ?? '';

const store = createPocketBaseStore({ baseUrl, token });
const guard = createMailboxGuard({ store });

createGuardServer(guard).listen(port, '0.0.0.0');

const purgeEveryMs = 60 * 60 * 1000;
setInterval(() => {
  guard.purge().catch(() => {});
}, purgeEveryMs);
