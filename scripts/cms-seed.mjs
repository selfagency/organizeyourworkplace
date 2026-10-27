// Copies the content from one PocketBase instance to another.
//
// The cms lives in PocketHost (oyw.pockethost.io). The content is
// authored in the local dev instance, and this brings it over. It is a
// copy, not a move: the local instance keeps working.
//
//   node scripts/cms-seed.mjs
//
// Where it reads from and writes to:
//   SOURCE_PB_URL / SOURCE_PB_TOKEN      where the content comes from
//   POCKETBASE_API_URL / POCKETBASE_API_TOKEN   where it goes (or PB_URL/PB_TOKEN)
//   PB_EMAIL + PB_PASS                    a superuser login, when there is no token
//
// Every collection is matched on its own key, so running it twice does not
// make duplicates. It prints what it wrote.
import { mkdirSync, writeFileSync } from 'node:fs';

for (const file of ['.env', '.env.local']) {
  try {
    process.loadEnvFile(file);
  } catch {
    // No such file. The environment has to carry it.
  }
}

const TARGET_URL = (process.env.PB_URL ?? process.env.POCKETBASE_API_URL ?? '').replace(/\/+$/, '');
const TARGET_TOKEN = process.env.PB_TOKEN ?? process.env.POCKETBASE_API_TOKEN ?? '';
const SOURCE_URL = (process.env.SOURCE_PB_URL ?? 'http://127.0.0.1:8090').replace(/\/+$/, '');
const SOURCE_TOKEN = process.env.SOURCE_PB_TOKEN ?? '';
const EMAIL = process.env.PB_EMAIL ?? 'agent@localhost.local';
const PASS = process.env.PB_PASS ?? 'devsuperuser123';

if (!TARGET_URL) {
  console.error('No target: set POCKETBASE_API_URL and POCKETBASE_API_TOKEN (or PB_URL and PB_TOKEN).');
  process.exit(1);
}

async function auth(url, token) {
  if (token) return token;
  const res = await fetch(`${url}/api/collections/_superusers/auth-with-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identity: EMAIL, password: PASS }),
  });
  if (!res.ok) throw new Error(`auth failed at ${url}: ${res.status}`);
  return (await res.json()).token;
}

async function fetchAll(url, token, collection) {
  const out = [];
  let page = 1;
  for (;;) {
    const res = await fetch(`${url}/api/collections/${collection}/records?perPage=200&page=${page}`, {
      headers: { Authorization: token },
    });
    if (!res.ok) throw new Error(`list ${collection} at ${url}: ${res.status} ${await res.text()}`);
    const data = await res.json();
    out.push(...(data.items ?? []));
    if (!data.items || data.items.length < 200) break;
    page++;
  }
  return out;
}

/** The key that says "this is the same record". */
const KEYS = {
  pages: (r) => `${r.slug}|${r.lang}`,
  unions: (r) => r.union_id,
  sectors: (r) => r.sector_id,
  legal_rules: (r) => r.rule_id,
  state_laws: (r) => `${r.state}|${r.topic}`,
  help_resources: (r) => `${r.type}|${r.name}|${r.area_served}`,
  campaigns: (r) => `${r.employer}|${r.union}|${r.year}`,
  sources: (r) => r.id,
  locals: (r) => r.id,
};

/** The fields that belong to the record, not to PocketBase. */
function body(record) {
  const out = {};
  for (const [k, v] of Object.entries(record)) {
    if (['id', 'collectionId', 'collectionName', 'created', 'updated'].includes(k)) continue;
    out[k] = v;
  }
  return out;
}

async function run() {
  const sourceToken = await auth(SOURCE_URL, SOURCE_TOKEN);
  const targetToken = await auth(TARGET_URL, TARGET_TOKEN);

  for (const [collection, key] of Object.entries(KEYS)) {
    const records = await fetchAll(SOURCE_URL, sourceToken, collection);
    const existing = await fetchAll(TARGET_URL, targetToken, collection);
    const byKey = new Map(existing.map((r) => [key(r), r]));

    let made = 0;
    let changed = 0;
    const queue = records.map((record) => async () => {
      const found = byKey.get(key(record));
      const payload = body(record);
      if (!found) {
        const res = await fetch(`${TARGET_URL}/api/collections/${collection}/records`, {
          method: 'POST',
          headers: { Authorization: targetToken, 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        if (!res.ok) throw new Error(`create ${collection}: ${res.status} ${await res.text()}`);
        made++;
        return;
      }
      // Only write when something actually changed.
      const same = Object.entries(payload).every(([k, v]) => JSON.stringify(found[k]) === JSON.stringify(v));
      if (same) return;
      const res = await fetch(`${TARGET_URL}/api/collections/${collection}/records/${found.id}`, {
        method: 'PATCH',
        headers: { Authorization: targetToken, 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error(`update ${collection}: ${res.status} ${await res.text()}`);
      changed++;
    });

    // Ten at a time: quick, and gentle on the instance.
    for (let i = 0; i < queue.length; i += 10) {
      await Promise.all(queue.slice(i, i + 10).map((task) => task()));
    }
    console.log(`${collection}: ${records.length} read, ${made} created, ${changed} updated`);
  }
}

await run();
console.log('the content is on the target instance');
