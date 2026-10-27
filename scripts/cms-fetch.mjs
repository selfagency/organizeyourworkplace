// Fetches the content and the records from the PocketBase `cms` at build
// time. The cms is the system of truth for everything the site shows
// (plans/07-stack-and-hosting.md A4, P4). The build reads what this script
// writes; it never reads a copy of the content that lives in the repo.
//
//   node scripts/cms-fetch.mjs                 -> .cache/cms (the build input)
//   node scripts/cms-fetch.mjs --mirror data   -> also refreshes data/*.json
//
// Where it reads from:
//   PB_URL                the cms instance (required)
//   PB_TOKEN              a superuser or impersonate token (preferred)
//   PB_EMAIL + PB_PASS    a superuser login (the local dev default)
//
// With no PB_URL the script does nothing and says so, unless
// CONTENT_REQUIRED=1, which makes it fail. A build that must have the
// content sets that, so a missing database can never ship an empty site.
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';

// A local .env file, if there is one, so `npm run dev` finds the cms
// without the shell having to carry it.
try {
  process.loadEnvFile('.env');
} catch {
  // No .env file. The environment has to carry it.
}

const args = process.argv.slice(2);
const outDir = args[args.indexOf('--out') + 1] && args.includes('--out')
  ? args[args.indexOf('--out') + 1]
  : '.cache/cms';
const mirror = args.includes('--mirror');

const BASE = (process.env.PB_URL ?? '').replace(/\/+$/, '');
const TOKEN = process.env.PB_TOKEN ?? '';
const EMAIL = process.env.PB_EMAIL ?? 'agent@localhost.local';
const PASS = process.env.PB_PASS ?? 'devsuperuser123';

if (!BASE) {
  const required = process.env.CONTENT_REQUIRED === '1';
  const message =
    'No PB_URL: the site builds without content. Set PB_URL (and PB_TOKEN, or PB_EMAIL and PB_PASS) to load it from the cms.';
  // The directory exists even with no content, so the build finds an empty
  // collection instead of a missing path.
  mkdirSync(join(outDir, 'pages'), { recursive: true });
  if (required) {
    console.error('ERROR: ' + message + ' CONTENT_REQUIRED=1 is set.');
    process.exit(1);
  }
  console.warn('WARNING: ' + message);
  process.exit(0);
}

async function auth() {
  if (TOKEN) return TOKEN;
  const res = await fetch(`${BASE}/api/collections/_superusers/auth-with-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identity: EMAIL, password: PASS }),
  });
  if (!res.ok) throw new Error(`auth failed: ${res.status} ${await res.text()}`);
  return (await res.json()).token;
}

async function fetchAll(token, collection) {
  const out = [];
  let page = 1;
  for (;;) {
    const res = await fetch(`${BASE}/api/collections/${collection}/records?perPage=200&page=${page}`, {
      headers: { Authorization: token },
    });
    if (!res.ok) throw new Error(`list ${collection}: ${res.status} ${await res.text()}`);
    const data = await res.json();
    out.push(...(data.items ?? []));
    if (!data.items || data.items.length < 200) break;
    page++;
  }
  return out;
}

function yamlString(v) {
  return JSON.stringify(v);
}

function frontMatter(rec) {
  const lines = [];
  lines.push(`title: ${yamlString(rec.title)}`);
  lines.push(`section: ${rec.section}`);
  // PB number fields coerce empty to 0; stage 0 is never valid (the schema
  // is 1-8), so 0 means "no stage" and the line is left out.
  if (rec.stage) lines.push(`stage: ${rec.stage}`);
  lines.push(`legal: ${rec.legal ? 'true' : 'false'}`);
  if (rec.status_as_of) lines.push(`status_as_of: ${rec.status_as_of.slice(0, 10)}`);
  lines.push(`review: ${rec.review}`);
  if (rec.sources?.length) lines.push(`sources: [${rec.sources.join(', ')}]`);
  if (rec.related_tools?.length) lines.push(`related_tools: [${rec.related_tools.join(', ')}]`);
  if (rec.next_steps?.length) {
    lines.push('next_steps:');
    for (const step of rec.next_steps) lines.push(`  - { text: ${yamlString(step.text)}, href: ${step.href} }`);
  }
  lines.push(`lang: ${rec.lang}`);
  lines.push(`translation_of: ${rec.translation_of ? rec.translation_of : 'null'}`);
  return lines.join('\n');
}

function slugToPath(slug) {
  // /rights/section-7 -> rights/section-7 ; / -> index ; /unions/ -> unions/index
  let p = slug.replace(/^\//, '');
  if (p === '' || p.endsWith('/')) p += 'index';
  return p;
}

// PB stores null date and url fields as "" — map them back to null.
const NULLABLE_KEYS = new Set([
  'status_as_of', 'effective', 'last_checked', 'date',
  'organizing_intake', 'local_finder', 'link', 'stage',
]);

const RECORDS = [
  ['unions', 'unions.json', 'union_id', 'id'],
  ['sectors', 'sectors.json', 'sector_id', 'id'],
  ['legal_rules', 'legal-rules.json', 'rule_id', 'id'],
  ['state_laws', 'state-laws.json', null, null],
  ['help_resources', 'help-resources.json', null, null],
  ['locals', 'locals.json', null, null],
  ['campaigns', 'campaigns.json', null, null],
  ['sources', 'sources.json', null, null],
];

function cleanRecord(r, keyField, idField) {
  const out = {};
  for (const [k, v] of Object.entries(r)) {
    if (['id', 'collectionId', 'collectionName', 'created', 'updated'].includes(k)) continue;
    if (keyField && k === keyField) {
      out[idField] = v;
      continue;
    }
    if (typeof v === 'string' && /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}/.test(v)) {
      out[k] = v.slice(0, 10);
      continue;
    }
    if (v === '' && NULLABLE_KEYS.has(k)) {
      out[k] = null;
      continue;
    }
    out[k] = v;
  }
  return out;
}

const token = await auth();

// Start from a clean directory: a page deleted in the cms must not survive
// in the build.
rmSync(outDir, { recursive: true, force: true });
mkdirSync(join(outDir, 'pages'), { recursive: true });

const pages = await fetchAll(token, 'pages');
for (const rec of pages) {
  const path = join(outDir, 'pages', rec.lang, `${slugToPath(rec.slug)}.md`);
  mkdirSync(dirname(path), { recursive: true });
  const body = (rec.body ?? '').replace(/^\n+/, '');
  writeFileSync(path, `---\n${frontMatter(rec)}\n---\n\n${body}`);
}
console.log(`fetched ${pages.length} pages from the cms`);

for (const [collection, file, keyField, idField] of RECORDS) {
  const records = await fetchAll(token, collection);
  const cleaned = records.map((r) => cleanRecord(r, keyField, idField));
  writeFileSync(join(outDir, file), `${JSON.stringify(cleaned, null, 2)}\n`);
  if (mirror) writeFileSync(join('data', file), `${JSON.stringify(cleaned, null, 2)}\n`);
  console.log(`fetched ${cleaned.length} ${collection}`);
}

console.log(`the build reads ${outDir}`);
