// Fetches the content and the records from the PocketBase `cms` at build
// time. The cms is the system of truth for everything the site shows
// (plans/07-stack-and-hosting.md A4, P4). The build reads what this script
// writes; it never reads a copy of the content that lives in the repo.
//
//   node scripts/cms-fetch.mjs                 -> .cache/cms (the build input)
//   node scripts/cms-fetch.mjs --mirror data   -> also refreshes data/*.json
//
// Where it reads from:
//   PB_URL or POCKETBASE_API_URL   the cms instance (required)
//   PB_TOKEN or POCKETBASE_API_TOKEN  a superuser or impersonate token (preferred)
//   PB_EMAIL + PB_PASS              a superuser login (the local dev default)
//
// With no PB_URL the script does nothing and says so, unless
// CONTENT_REQUIRED=1, which makes it fail. A build that must have the
// content sets that, so a missing database can never ship an empty site.
import { mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';

// The local env files, if they are there, so `npm run dev` finds the cms
// without the shell having to carry it. .env.local wins over .env, the
// same order Vite uses.
for (const file of ['.env', '.env.local']) {
  try {
    process.loadEnvFile(file);
  } catch {
    // No such file. The environment has to carry it.
  }
}

const args = process.argv.slice(2);
const outDir = args[args.indexOf('--out') + 1] && args.includes('--out')
  ? args[args.indexOf('--out') + 1]
  : '.cache/cms';
const mirror = args.includes('--mirror');

const BASE = (process.env.PB_URL ?? process.env.POCKETBASE_API_URL ?? '').replace(/\/+$/, '');
const TOKEN = process.env.PB_TOKEN ?? process.env.POCKETBASE_API_TOKEN ?? '';
// The dev login only applies to a local instance (localhost, or the alias a
// container build uses for the host's own cms). A real cms never gets a
// default password, so a forgotten PB_PASS fails as "you did not set it",
// not as a wrong-password error against the production box.
const LOCAL =
  /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\]|host\.docker\.internal)(:\d+)?\//.test(`${BASE}/`);
const EMAIL = process.env.PB_EMAIL ?? (LOCAL ? 'agent@localhost.local' : '');
const PASS = process.env.PB_PASS ?? (LOCAL ? 'devsuperuser123' : '');

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
  if (!EMAIL || !PASS) {
    // A real cms carries its token in the environment. The dev login is a
    // local convenience, never a default for the box.
    throw new Error('no PB_TOKEN and no PB_EMAIL/PB_PASS: set one of them');
  }
  const res = await request(`${BASE}/api/collections/_superusers/auth-with-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identity: EMAIL, password: PASS }),
  });
  if (!res.ok) throw new Error(`auth failed: ${res.status} ${await res.text()}`);
  return (await res.json()).token;
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * The host rate limits the API paths (1,000 an hour per IP). A 429 means
 * "slow down", and the host says how long to wait, so the request waits
 * and tries again. A dropped connection is the same kind of thing.
 */
async function request(url, init, tries = 2) {
  let wait = 1000;
  for (let attempt = 0; ; attempt++) {
    let res;
    try {
      res = await fetch(url, init);
    } catch (error) {
      if (attempt >= tries - 1) throw error;
      await sleep(wait + Math.random() * 400);
      wait = Math.min(wait * 2, 30_000);
      continue;
    }
    if (res.status !== 429) return res;
    if (attempt >= tries - 1) {
      throw new Error(`rate limited: ${res.status} ${await res.text()}`);
    }
    const text = await res.text();
    const told = text.match(/retry after (\d+) seconds/);
    const toldMs = told ? Number(told[1]) * 1000 : wait;
    await sleep(Math.min(Math.max(toldMs, wait), 180_000) + Math.random() * 500);
    wait = Math.min(wait * 2, 30_000);
  }
}

async function fetchAllFrom(collection) {
  const out = [];
  let page = 1;
  for (;;) {
    const res = await request(`${BASE}/api/collections/${collection}/records?perPage=200&page=${page}`, {
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

// The fetch goes into a scratch directory and only replaces the real one
// when it has finished, so a half-finished fetch never leaves the build
// with half a site.
const scratch = `${outDir}.fetching`;

async function fetchEverything() {
  rmSync(scratch, { recursive: true, force: true });
  mkdirSync(join(scratch, 'pages'), { recursive: true });

  const pages = await fetchAllFrom('pages');
  for (const rec of pages) {
    const path = join(scratch, 'pages', rec.lang, `${slugToPath(rec.slug)}.md`);
    mkdirSync(dirname(path), { recursive: true });
    const body = (rec.body ?? '').replace(/^\n+/, '');
    writeFileSync(path, `---\n${frontMatter(rec)}\n---\n\n${body}`);
  }
  console.log(`fetched ${pages.length} pages from the cms`);

  for (const [collection, file, keyField, idField] of RECORDS) {
    const records = await fetchAllFrom(collection);
    // A collection that has fewer records in the cms than in the committed
    // mirror means the copy is not finished. The mirror stays in place, so
    // the build never quietly loses records.
    let mirrorCount = 0;
    try {
      mirrorCount = JSON.parse(readFileSync(join('data', file), 'utf-8')).length;
    } catch {
      // No mirror for this collection.
    }
    if (records.length < mirrorCount) {
      console.warn(
        `WARNING: the cms has ${records.length} ${collection} and the mirror has ${mirrorCount}. Keeping the mirror for this build.`,
      );
      continue;
    }
    const cleaned = records.map((r) => cleanRecord(r, keyField, idField));
    writeFileSync(join(scratch, file), `${JSON.stringify(cleaned, null, 2)}\n`);
    if (mirror) writeFileSync(join('data', file), `${JSON.stringify(cleaned, null, 2)}\n`);
    console.log(`fetched ${cleaned.length} ${collection}`);
  }
}

const token = await auth();

try {
  await fetchEverything();
} catch (error) {
  rmSync(scratch, { recursive: true, force: true });
  const message = error instanceof Error ? error.message : String(error);
  if (process.env.CONTENT_REQUIRED === '1') {
    console.error(`ERROR: the cms could not be read: ${message}`);
    process.exit(1);
  }
  console.warn(`WARNING: the cms could not be read: ${message} The build uses what it has.`);
  process.exit(0);
}

// The real directory is replaced in one go.
rmSync(outDir, { recursive: true, force: true });
renameSync(scratch, outDir);
console.log(`the build reads ${outDir}`);
