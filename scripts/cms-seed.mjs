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
    const res = await request(`${url}/api/collections/${collection}/records?perPage=200&page=${page}`, {
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

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * PocketHost rate limits the API paths (1,000 requests an hour per IP), and
 * the connection sometimes drops under a burst. A 429 is a "slow down" and a
 * closed socket is a "try again", so both wait and try again. The host says
 * how long to wait in the message, and it is listened to.
 */
async function request(url, init, tries = 10) {
  let wait = 1000;
  for (let attempt = 0; ; attempt++) {
    let res;
    try {
      res = await fetch(url, init);
    } catch (error) {
      // The connection dropped. Wait and try again.
      if (attempt >= tries - 1) throw error;
      await sleep(wait + Math.random() * 400);
      wait = Math.min(wait * 2, 30_000);
      continue;
    }
    if (res.status !== 429) return res;
    if (attempt >= tries - 1) {
      const text = await res.text();
      throw new Error(`rate limited: ${res.status} ${text}`);
    }
    // The host puts the wait in the message: "retry after 2360 seconds".
    const text = await res.text();
    const told = text.match(/retry after (\d+) seconds/);
    const toldMs = told ? Number(told[1]) * 1000 : wait;
    await sleep(Math.min(Math.max(toldMs, wait), 3_600_000) + Math.random() * 500);
    wait = Math.min(wait * 2, 30_000);
  }
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
        const res = await request(`${TARGET_URL}/api/collections/${collection}/records`, {
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
      const res = await request(`${TARGET_URL}/api/collections/${collection}/records/${found.id}`, {
        method: 'PATCH',
        headers: { Authorization: targetToken, 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error(`update ${collection}: ${res.status} ${await res.text()}`);
      changed++;
    });

    // Three at a time. The host rate limits, so a burst gets a 429 and
    // every write waits it out.
    for (let i = 0; i < queue.length; i += 3) {
      await Promise.all(queue.slice(i, i + 3).map((task) => task()));
      if (records.length > 100 && i % 300 === 0) {
        console.log(`  ${collection}: ${i} of ${records.length}`);
      }
    }
    console.log(`${collection}: ${records.length} read, ${made} created, ${changed} updated`);
  }
}

await run();
console.log('the content is on the target instance');
