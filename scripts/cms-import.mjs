// Imports repo content into the PocketBase cms (the system of record).
// - data/cms-export/pages/**/*.md -> pages collection (front matter + body)
// - data/*.json                -> record collections
// Idempotent: upserts by natural key. Run after editing repo files, or let
// the nightly export/import pair keep both sides in sync.
// Usage: node scripts/cms-import.mjs
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const BASE = process.env.PB_URL ?? 'http://localhost:8090';
const EMAIL = process.env.PB_EMAIL ?? 'agent@localhost.local';
const PASS = process.env.PB_PASS ?? 'devsuperuser123';
const PAGES_DIR = 'data/cms-export/pages';
const DATA_DIR = 'data';

async function auth() {
  const res = await fetch(`${BASE}/api/collections/_superusers/auth-with-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identity: EMAIL, password: PASS }),
  });
  if (!res.ok) throw new Error(`auth failed: ${res.status}`);
  return (await res.json()).token;
}

function walk(dir) {
  const out = [];
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry);
    if (statSync(p).isDirectory()) out.push(...walk(p));
    else out.push(p);
  }
  return out;
}

/** Minimal YAML front matter parser for our flat + nested-list shape. */
function parseFrontMatter(text) {
  const match = text.match(/^---\n([\s\S]*?)\n---\n?/);
  if (!match) throw new Error('no front matter');
  const yaml = match[1];
  const body = text.slice(match[0].length);
  const data = {};
  let currentListKey = null;
  let currentItem = null;
  for (const rawLine of yaml.split('\n')) {
    const line = rawLine.replace(/\t/g, '  ');
    if (/^  - \{/.test(line) && currentListKey) {
      // list item that is an inline object: - { text: "...", href: /path }
      const item = parseInlineObject(line.trim().slice(2));
      data[currentListKey].push(item);
      currentItem = item;
      continue;
    }
    if (/^  - /.test(line) && currentListKey) {
      data[currentListKey].push(parseScalar(line.trim().slice(2)));
      continue;
    }
    if (/^  \{/.test(line) && currentItem) {
      Object.assign(currentItem, parseInlineObject(line.trim()));
      continue;
    }
    const top = line.match(/^(\w+):\s*(.*)$/);
    if (top) {
      const [, key, rest] = top;
      currentListKey = null;
      currentItem = null;
      if (rest === '') {
        // could be a list or null
        currentListKey = key;
        data[key] = [];
      } else {
        data[key] = parseScalar(rest);
      }
      continue;
    }
    if (/^  - /.test(line) && currentListKey) {
      data[currentListKey].push(parseScalar(line.trim().slice(2)));
    }
  }
  return { data, body };
}

function parseScalar(v) {
  const s = v.trim();
  if (s === 'null') return null;
  if (s === 'true') return true;
  if (s === 'false') return false;
  if (/^-?\d+(\.\d+)?$/.test(s)) return Number(s);
  if (/^\[.*\]$/.test(s)) {
    return s.slice(1, -1).split(',').map((x) => parseScalar(x)).filter((x) => x !== '');
  }
  return s.replace(/^["']|["']$/g, '');
}

function parseInlineObject(s) {
  // { text: "...", href: /path }
  const obj = {};
  const inner = s.replace(/^\{|\}$/g, '');
  const parts = inner.split(/,(?=\s*\w+:)/);
  for (const part of parts) {
    const m = part.match(/(\w+):\s*(.*)/);
    if (m) obj[m[1]] = parseScalar(m[2]);
  }
  return obj;
}

async function upsert(token, collection, filter, record, label = record.id ?? record.slug ?? record.name ?? '?') {
  const find = await fetch(
    `${BASE}/api/collections/${collection}/records?filter=${encodeURIComponent(filter)}`,
    { headers: { Authorization: token } },
  );
  const found = (await find.json()).items ?? [];
  const method = found.length > 0 ? 'PATCH' : 'POST';
  const url = found.length > 0 ? `${BASE}/api/collections/${collection}/records/${found[0].id}` : `${BASE}/api/collections/${collection}/records`;
  const res = await fetch(url, {
    method,
    headers: { 'Content-Type': 'application/json', Authorization: token },
    body: JSON.stringify(record),
  });
  if (!res.ok) throw new Error(`${collection}/${label}: ${res.status} ${(await res.text()).slice(0, 300)}`);
}

const token = await auth();

// 1. Pages
const pageFiles = walk(PAGES_DIR).filter((f) => f.endsWith('.md'));
for (const file of pageFiles) {
  const rel = relative(PAGES_DIR, file);
  const [lang, ...rest] = rel.split('/');
  const slug = '/' + rest.join('/').replace(/\.md$/, '').replace(/(^|\/)index$/, '$1');
  const text = readFileSync(file, 'utf-8');
  const { data, body: rawBody } = parseFrontMatter(text);
  const body = rawBody.replace(/^\n+/, '');
  await upsert(token, 'pages', `slug="${slug}" && lang="${lang}"`, {
    slug,
    title: data.title,
    section: data.section,
    stage: data.stage ?? null,
    legal: data.legal ?? false,
    status_as_of: data.status_as_of ? `${data.status_as_of} 00:00:00.000Z` : null,
    review: data.review ?? 'pending',
    sources: data.sources ?? [],
    related_tools: data.related_tools ?? [],
    next_steps: data.next_steps ?? [],
    lang,
    translation_of: data.translation_of ?? null,
    body,
  });
}
console.log(`imported ${pageFiles.length} pages`);

// 2. Records
const recordSets = [
  ['unions.json', 'unions', 'union_id', 'id'],
  ['sectors.json', 'sectors', 'sector_id', 'id'],
  ['legal-rules.json', 'legal_rules', 'rule_id', 'id'],
  ['state-laws.json', 'state_laws', 'state', 'state'],
  ['help-resources.json', 'help_resources', 'name', 'name'],
];
for (const [file, collection, keyField, idField] of recordSets) {
  const records = JSON.parse(readFileSync(join(DATA_DIR, file), 'utf-8'));
  for (const r of records) {
    const rec = { ...r };
    // dates -> PB datetime strings
    for (const [k, v] of Object.entries(rec)) {
      if (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v)) rec[k] = `${v} 00:00:00.000Z`;
    }
    if (rec.id) {
      rec[`${collection.slice(0, -1)}_id`] = rec.id;
      delete rec.id;
    }
    if (collection === 'unions' && rec.union_id === undefined) rec.union_id = r.id;
    if (collection === 'sectors' && rec.sector_id === undefined) rec.sector_id = r.id;
    if (collection === 'legal_rules' && rec.rule_id === undefined) rec.rule_id = r.id;
    await upsert(token, collection, `${keyField}="${String(rec[keyField]).replace(/"/g, '')}"`, rec);
  }
  console.log(`imported ${records.length} ${collection}`);
}
console.log('done');