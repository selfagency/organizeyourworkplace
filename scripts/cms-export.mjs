// Exports the PocketBase cms to the repo (the nightly git export, P4).
// - pages collection  -> data/cms-export/pages/{lang}/**.md (front matter + body)
// - record collections -> data/*.json
// The Astro build reads ONLY this export — it never talks to PocketBase.
// Usage: node scripts/cms-export.mjs
import { writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';

const BASE = process.env.PB_URL ?? 'http://localhost:8090';
const EMAIL = process.env.PB_EMAIL ?? 'agent@localhost.local';
const PASS = process.env.PB_PASS ?? 'devsuperuser123';
const OUT_PAGES = 'data/cms-export/pages';
const OUT_DATA = 'data';

async function auth() {
  const res = await fetch(`${BASE}/api/collections/_superusers/auth-with-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identity: EMAIL, password: PASS }),
  });
  if (!res.ok) throw new Error(`auth failed: ${res.status}`);
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

function yamlList(items) {
  return items.map((i) => `  - ${typeof i === 'object' ? JSON.stringify(i) : yamlString(i)}`).join('\n');
}

function frontMatter(rec) {
  const lines = [];
  lines.push(`title: ${yamlString(rec.title)}`);
  lines.push(`section: ${rec.section}`);
  if (rec.stage !== null && rec.stage !== undefined) lines.push(`stage: ${rec.stage}`);
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

// PB stores null date/url fields as "" — map back to null on export.
const NULLABLE_KEYS = new Set([
  'status_as_of', 'effective', 'last_checked', 'date',
  'organizing_intake', 'local_finder', 'link',
]);

const token = await auth();

// Pages
const pages = await fetchAll(token, 'pages');
for (const rec of pages) {
  const path = join(OUT_PAGES, rec.lang, `${slugToPath(rec.slug)}.md`);
  mkdirSync(dirname(path), { recursive: true });
  const fm = frontMatter(rec);
  const body = (rec.body ?? '').replace(/^\n+/, '');
  writeFileSync(path, `---\n${fm}\n---\n\n${body}`);
}
console.log(`exported ${pages.length} pages`);

// Records
const recordSets = [
  ['unions', 'unions.json', 'union_id', 'id'],
  ['sectors', 'sectors.json', 'sector_id', 'id'],
  ['legal_rules', 'legal-rules.json', 'rule_id', 'id'],
  ['state_laws', 'state-laws.json', null, null],
  ['help_resources', 'help-resources.json', null, null],
];
for (const [collection, file, keyField, idField] of recordSets) {
  const records = await fetchAll(token, collection);
  const cleaned = records.map((r) => {
    const out = {};
    for (const [k, v] of Object.entries(r)) {
      if (['id', 'collectionId', 'collectionName', 'created', 'updated'].includes(k)) continue;
      if (keyField && k === keyField) {
        out[idField] = v;
        continue;
      }
      // dates -> ISO date strings; PB stores null dates as ""
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
  });
  writeFileSync(join(OUT_DATA, file), `${JSON.stringify(cleaned, null, 2)}\n`);
  console.log(`exported ${cleaned.length} ${collection}`);
}
console.log('done');