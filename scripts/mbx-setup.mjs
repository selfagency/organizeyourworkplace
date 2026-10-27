// Creates the `queue` collection in the mbx PocketBase instance (P7).
// One collection, no accounts, no relations, superuser-only rules: the
// public door to the mailbox is deploy/mailbox/guard.mjs, not PocketBase.
// Idempotent: skips the collection if it already exists.
// Usage: PB_URL=http://mbx:8090 node scripts/mbx-setup.mjs
const BASE = process.env.PB_URL ?? 'http://localhost:8090';
const EMAIL = process.env.PB_EMAIL ?? 'agent@localhost.local';
const PASS = process.env.PB_PASS ?? 'devsuperuser123';

async function auth() {
  const res = await fetch(`${BASE}/api/collections/_superusers/auth-with-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identity: EMAIL, password: PASS }),
  });
  if (!res.ok) throw new Error(`auth failed: ${res.status} ${await res.text()}`);
  return (await res.json()).token;
}

async function listCollections(token) {
  const res = await fetch(`${BASE}/api/collections?perPage=200`, {
    headers: { Authorization: token },
  });
  const data = await res.json();
  return new Set((data.items ?? []).map((collection) => collection.name));
}

const field = (name, type, extra = {}) => ({ name, type, ...extra });

const queue = {
  name: 'queue',
  type: 'base',
  // null means locked to superusers. An empty string would make the
  // collection public, and the guard is the only public door (P7, P10).
  listRule: null,
  viewRule: null,
  createRule: null,
  updateRule: null,
  deleteRule: null,
  indexes: ['CREATE INDEX idx_queue_label ON queue (label)'],
  fields: [
    field('label', 'text', { required: true, max: 32 }),
    field('blob', 'text', { required: true, max: 100000 }),
    field('expires_at', 'date', { required: true }),
    field('seq', 'number', { required: true, min: 0 }),
  ],
};

const token = await auth();
const existing = await listCollections(token);
if (existing.has(queue.name)) {
  console.log(`exists: ${queue.name}`);
} else {
  const res = await fetch(`${BASE}/api/collections`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: token },
    body: JSON.stringify(queue),
  });
  if (!res.ok) throw new Error(`create ${queue.name}: ${res.status} ${await res.text()}`);
  console.log(`created ${queue.name}`);
}
