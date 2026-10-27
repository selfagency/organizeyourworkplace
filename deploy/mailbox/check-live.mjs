/**
 * Live check of the mailbox guard against a running PocketBase.
 *
 * The unit tests use the memory store, so the PocketBase adapter needs one
 * real run. Start the local mailbox instance first:
 *
 *   docker compose -f deploy/docker-compose.local.yml -p oyw-local up -d mbx
 *   docker exec oyw-local-mbx-1 /pb/pocketbase superuser upsert agent@localhost.local devsuperuser123
 *   PB_URL=http://localhost:8091 node scripts/mbx-setup.mjs
 *   node deploy/mailbox/check-live.mjs
 */
import { createGuardServer, createMailboxGuard, createPocketBaseStore } from './guard.mjs';

const baseUrl = process.env.PB_URL ?? 'http://localhost:8091';
const email = process.env.PB_EMAIL ?? 'agent@localhost.local';
const pass = process.env.PB_PASS ?? 'devsuperuser123';

const auth = await fetch(`${baseUrl}/api/collections/_superusers/auth-with-password`, {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ identity: email, password: pass }),
});
if (!auth.ok) throw new Error(`auth failed: ${auth.status}`);
const { token } = await auth.json();

const store = createPocketBaseStore({ baseUrl, token });
const guard = createMailboxGuard({ store });

const label = 'AbCdEfGhIjKlMnOpQrStUv';
const put = await guard.put({
  label,
  blob: 'opaque-ciphertext',
  expiresAt: Date.now() + 60_000,
  ip: '127.0.0.1',
});
console.log('put:', put.status, put.ok ? 'accepted' : put.reason);

const list = await guard.list({ label, since: 0 });
console.log('list:', list.status, list.items?.length ?? 0, 'item(s)');
if (list.items?.length) console.log('blob round-trips:', list.items[0].blob === 'opaque-ciphertext');

const purged = await guard.purge();
console.log('purge:', purged.ok, 'rows still live:', (await guard.list({ label, since: 0 })).items?.length ?? 0);

const shortLabel = 'ZyXwVuTsRqPoNmLkJiHgFe';
await guard.put({
  label: shortLabel,
  blob: 'short-lived',
  expiresAt: Date.now() + 1000,
  ip: '127.0.0.1',
});
await new Promise((resolve) => setTimeout(resolve, 1200));
const afterExpiry = await guard.purge();
console.log('purge after expiry removed:', afterExpiry.removed, 'row(s)');
console.log('rows left for that label:', (await guard.list({ label: shortLabel, since: 0 })).items?.length ?? 0);

const port = 8099;
const server = createGuardServer(guard);
await new Promise((resolve) => server.listen(port, '127.0.0.1', resolve));
const health = await fetch(`http://127.0.0.1:${port}/health`).then((response) => response.json());
console.log('http health:', health.ok);
await new Promise((resolve) => server.close(resolve));

const anonymous = await fetch(`${baseUrl}/api/collections/queue/records`).then((response) => response.status);
console.log('pocketbase without a token:', anonymous, anonymous === 403 ? '(locked)' : '(NOT LOCKED)');
