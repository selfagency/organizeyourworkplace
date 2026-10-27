// Creates the cms collections in a PocketBase instance over the API.
// The schema of record is the migration in pb_migrations/; this is the
// shortcut for a throwaway dev instance. For a real one, run
// `pocketbase migrate up --migrationsDir=pb_migrations` or `phio deploy`.
// Idempotent: skips collections that already exist.
// Usage: node scripts/cms-setup.mjs

const BASE = (process.env.PB_URL ?? process.env.POCKETBASE_API_URL ?? 'http://localhost:8090').replace(/\/+$/, '');
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
  return new Set((data.items ?? []).map((c) => c.name));
}

async function createCollection(token, def) {
  const res = await fetch(`${BASE}/api/collections`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: token },
    body: JSON.stringify(def),
  });
  if (!res.ok) throw new Error(`create ${def.name}: ${res.status} ${await res.text()}`);
  console.log(`created ${def.name}`);
}

const field = (name, type, extra = {}) => ({ name, type, ...extra });

const defs = [
  {
    name: 'pages',
    type: 'base',
    fields: [
      field('title', 'text', { required: true }),
      field('slug', 'text', { required: true }),
      field('section', 'select', { required: true, maxSelect: 1, values: ['start','rights','organize','unions','vote','contract','run','case','toolkit','help','about'] }),
      field('stage', 'number'),
      field('legal', 'bool'),
      field('status_as_of', 'date'),
      field('review', 'select', { maxSelect: 1, values: ['pending','approved'] }),
      field('sources', 'json'),
      field('related_tools', 'json'),
      field('next_steps', 'json'),
      field('lang', 'select', { required: true, maxSelect: 1, values: ['en','es'] }),
      field('translation_of', 'text'),
      field('body', 'editor'),
    ],
  },
  {
    name: 'unions',
    type: 'base',
    fields: [
      field('union_id', 'text', { required: true }),
      field('name', 'text', { required: true }),
      field('abbreviation', 'text'),
      field('affiliation', 'text'),
      field('sectors', 'json'),
      field('who_they_organize', 'text'),
      field('organizing_intake', 'url'),
      field('intake_note', 'text'),
      field('local_finder', 'url'),
      field('local_finder_note', 'text'),
      field('recent_wins', 'json'),
      field('recent_example', 'text'),
      field('status', 'select', { required: true, maxSelect: 1, values: ['verified','partially_verified','to_verify'] }),
      field('last_checked', 'date'),
      field('sources', 'json'),
    ],
  },
  {
    name: 'sectors',
    type: 'base',
    fields: [
      field('sector_id', 'text', { required: true }),
      field('name', 'text', { required: true }),
      field('plain_jobs', 'text'),
      field('unions', 'json'),
      field('union_density', 'number'),
      field('notes', 'text'),
    ],
  },
  {
    name: 'legal_rules',
    type: 'base',
    fields: [
      field('rule_id', 'text', { required: true }),
      field('rule', 'text', { required: true }),
      field('plain_summary', 'text'),
      field('status', 'select', { required: true, maxSelect: 1, values: ['in_force','targeted','split_by_circuit','overturned'] }),
      field('where_it_applies', 'text'),
      field('status_as_of', 'date'),
      field('citation', 'text'),
      field('what_to_tell_workers', 'text'),
      field('history', 'json'),
    ],
  },
  {
    name: 'state_laws',
    type: 'base',
    fields: [
      field('state', 'text', { required: true }),
      field('topic', 'text', { required: true }),
      field('status', 'text'),
      field('effective', 'date'),
      field('citation', 'text'),
      field('status_as_of', 'date'),
    ],
  },
  {
    name: 'help_resources',
    type: 'base',
    fields: [
      field('type', 'select', { required: true, maxSelect: 1, values: ['lawyer','worker_center','nlrb_office','legal_clinic'] }),
      field('name', 'text', { required: true }),
      field('area_served', 'text'),
      field('languages', 'json'),
      field('contact', 'text'),
      field('source', 'text'),
      field('last_checked', 'date'),
    ],
  },
  {
    name: 'campaigns',
    type: 'base',
    fields: [
      field('employer', 'text', { required: true }),
      field('union', 'text'),
      field('sector', 'text'),
      field('outcome', 'text'),
      field('year', 'number'),
      field('link', 'url'),
      field('source', 'text'),
    ],
  },
  {
    name: 'sources',
    type: 'base',
    fields: [
      field('source_id', 'text', { required: true }),
      field('title', 'text', { required: true }),
      field('publisher', 'text'),
      field('tier', 'number'),
      field('date', 'date'),
      field('url', 'url'),
    ],
  },
];

const token = await auth();
const existing = await listCollections(token);
for (const def of defs) {
  if (existing.has(def.name)) {
    console.log(`exists: ${def.name}`);
    continue;
  }
  await createCollection(token, def);
}
console.log('done');