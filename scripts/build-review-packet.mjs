// R1.G lawyer-review packet generator (plans/00-roadmap.md).
// Produces review-packet.md: every legal ([!]) page, its as-of date, review
// status, cited sources, outbound links, and the factual claims that carry
// sources — for a labor lawyer to review. Output: docs/review-packet.md.
// Run: node scripts/build-review-packet.mjs
import { existsSync, readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

// The pages the cms gave us. The build fetches them into .cache/cms; the
// committed export is the fallback.
const PAGES_DIR = existsSync('.cache/cms/pages')
  ? '.cache/cms/pages'
  : 'data/cms-export/pages';
const SOURCES_MD = 'plans/sources.md';
const OUT = 'docs/review-packet.md';

function walk(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out.push(...walk(p));
    else if (p.endsWith('.md')) out.push(p);
  }
  return out;
}

// Parse minimal front matter without a YAML lib (keep dependencies zero).
function frontMatter(text) {
  const m = text.match(/^---\n([\s\S]*?)\n---/);
  if (!m) return {};
  const fm = {};
  for (const line of m[1].split('\n')) {
    const kv = line.match(/^(\w+):\s*(.*)$/);
    if (kv) fm[kv[1]] = kv[2].trim();
  }
  return fm;
}

// Source IDs used in the body: [A12], [P1-6] style refs.
function usedSources(body) {
  return [...new Set([...body.matchAll(/\[((?:A|P\d)-?\d+[-\d]*)\]/g)].map((m) => m[1]))];
}

// Inline external links (markdown link syntax with http(s)).
function externalLinks(body) {
  return [...new Set([...body.matchAll(/\]\((https?:\/\/[^)]+)\)/g)].map((m) => m[1]))];
}

// Claim sentences: lines with a source ref or TODO(verify).
function claims(body) {
  return body
    .split('\n')
    .filter((l) => /\[(?:A|P\d)-?\d+[-\d]*\]|TODO\(verify\)/.test(l))
    .map((l) => l.trim().replace(/^[-*\s]+/, '').slice(0, 300));
}

const sources = readFileSync(SOURCES_MD, 'utf-8');
const files = walk(PAGES_DIR).sort();
const pages = [];

for (const file of files) {
  const text = readFileSync(file, 'utf-8');
  const fm = frontMatter(text);
  if (fm.legal !== 'true') continue;
  const lang = relative(PAGES_DIR, file).split('/')[0];
  const slug = '/' + relative(PAGES_DIR, file)
    .split('/').slice(1).join('/')
    .replace(/\.md$/, '')
    .replace(/(^|\/)index$/, '$1');
  const body = text.replace(/^---\n[\s\S]*?\n---/, '');
  pages.push({
    file: relative(PAGES_DIR, file),
    lang,
    slug,
    title: (fm.title ?? '').replace(/^"|"$/g, ''),
    asOf: fm.status_as_of ?? 'MISSING',
    review: fm.review ?? 'MISSING',
    sources: usedSources(body),
    links: externalLinks(body),
    claims: claims(body),
  });
}

// Which cited source IDs resolve in sources.md?
const sourceIds = new Set([...sources.matchAll(/^\| ((?:A|P\d)-?\d+[-\d]*) \|/gm)].map((m) => m[1]));

const lines = [
  '# Lawyer review packet — R1.G',
  '',
  `Generated: ${new Date().toISOString().slice(0, 10)} · pages: ${pages.length} (all front-matter \`legal: true\`)`,
  '',
  'Purpose: labor-lawyer review of every legal page before any `review:` flag is set to `approved`.',
  'Each page lists: as-of date, review status, cited sources (with resolution check),',
  'external links, and the claim-bearing lines. EN and ES mirrors are listed separately;',
  'content is translated, not paraphrased — reviewing the EN copy covers the ES mirror,',
  'but spot-check at least the legal notices on ES pages.',
  '',
  `Source IDs referenced: ${sourceIds.size} known. Unresolved IDs below are errors.`,
  '',
  '---',
  '',
];

let unresolvedTotal = 0;
for (const p of pages) {
  const unresolved = p.sources.filter((s) => !sourceIds.has(s));
  unresolvedTotal += unresolved.length;
  lines.push(`## ${p.slug} (${p.lang})`);
  lines.push('');
  lines.push(`- file: \`${p.file}\``);
  lines.push(`- title: ${p.title}`);
  lines.push(`- status as of: ${p.asOf}${p.asOf === 'MISSING' ? '  ← ERROR: legal page without a date' : ''}`);
  lines.push(`- review: ${p.review}`);
  lines.push(`- sources cited: ${p.sources.length ? p.sources.join(', ') : 'none'}${unresolved.length ? `  ← UNRESOLVED: ${unresolved.join(', ')}` : ''}`);
  if (p.links.length) lines.push(`- external links: ${p.links.join(' · ')}`);
  lines.push('');
  lines.push('Claim-bearing lines:');
  lines.push('');
  if (p.claims.length) for (const c of p.claims) lines.push(`> ${c}`);
  else lines.push('> (none — page has no source-referenced factual claims)');
  lines.push('');
  lines.push('---');
  lines.push('');
}

lines.push(`## Totals: ${pages.length} legal pages · ${unresolvedTotal} unresolved source references`);
writeFileSync(OUT, lines.join('\n') + '\n');
console.log(`${OUT}: ${pages.length} legal pages, ${unresolvedTotal} unresolved source refs`);
if (pages.some((p) => p.asOf === 'MISSING' || p.review === 'MISSING')) {
  console.error('ERROR: some legal pages lack status_as_of or review — see packet');
  process.exit(1);
}
