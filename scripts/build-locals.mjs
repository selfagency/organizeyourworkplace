// Builds data/locals.json from the OLMS bulk filing data (pipe-delimited zip).
// Source: DOL OLMS Online Public Disclosure Room "Download Yearly Data"
// (https://olmsapps.dol.gov/olpdr/, LM_data_data_<year>.txt inside the year zip).
// Pipeline: unzip the year file to a temp dir, then:
//   node scripts/build-locals.mjs /tmp/olms/lm_data_data_2025.txt 2025
// Only locals whose parent affiliate is in the verified directory are kept.
// organizing_active is always false: LM filings do not tell us whether a local
// is actively organizing (AGENTS.md rule 4 — do not invent).
import { readFileSync, writeFileSync } from 'node:fs';

const [file, year] = process.argv.slice(2);
if (!file || !year) {
  console.error('usage: node scripts/build-locals.mjs <lm_data_data_FILE> <year>');
  process.exit(1);
}

// Directory union slug -> OLMS AFF_ABBR codes (verified against the 2025 file).
const PARENTS = {
  nnu: ['NNU'],
  seiu: ['SEIU'],
  'unite-here': ['UNITHE'],
  'workers-united': ['WU'],
  ufcw: ['UFCW'],
  rwdsu: ['RWDSU'],
  teamsters: ['IBT'],
  uaw: ['UAW'],
  usw: ['USW'],
  iam: ['IAM'],
  ue: ['UE'],
  cwa: ['CWA'],
  'film-tv-arts-unions': ['IATSE'],
  'airline-unions': ['AFA', 'ALPA'],
  nabtu: ['IBEW', 'LIUNA', 'IUOE'],
};
// Deliberately NOT mapped (would mislabel — the LM file cannot separate them):
//   AFSCME (all locals) -> afscme-cwu row is Cultural Workers United only
//   OPEIU (all locals)  -> neu row is one OPEIU local
//   TWU                 -> includes transit locals that are not airline units
// Matched by union name instead of affiliate code:
//   nuhw: rows where UNION_NAME contains "NUHW"
// Not derivable from LM filings (skipped, documented in the roadmap):
//   newsguild, npeu, seiu-building-services, ussw, uaw-higher-ed, afscme-cwu, neu

const unions = JSON.parse(readFileSync('data/unions.json', 'utf-8'));
const sectorsByUnion = Object.fromEntries(unions.map((u) => [u.id, u.sectors]));
const nameByUnion = Object.fromEntries(unions.map((u) => [u.id, u.name]));

const abbrToParent = Object.entries(PARENTS).flatMap(([parent, codes]) =>
  codes.map((code) => [code, parent]),
);
const parentByAbbr = Object.fromEntries(abbrToParent);

const lines = readFileSync(file, 'utf-8').split('\n');
const header = lines[0].split('|');
const col = (name) => header.indexOf(name);
const C = {
  name: col('UNION_NAME'), abbr: col('AFF_ABBR'), fnum: col('F_NUM'),
  members: col('MEMBERS'), street: col('STREET_ADR'), city: col('CITY'),
  state: col('STATE'), terminate: col('TERMINATE'), form: col('FORM_TYPE'),
  reg: col('REGISTER_DATE'),
};

const byKey = new Map();
let skippedTerminated = 0, skippedForm = 0, matched = 0;

for (const line of lines.slice(1)) {
  if (!line.trim()) continue;
  const f = line.split('|');
  if (f[C.terminate] === 'T') { skippedTerminated++; continue; }
  if (!/LM-[234]/.test(f[C.form] ?? '') && f[C.form] !== 'Simplified') { skippedForm++; continue; }

  const abbr = (f[C.abbr] ?? '').trim();
  const name = (f[C.name] ?? '').trim();
  let parent = parentByAbbr[abbr] ?? null;
  if (!parent && /NUHW/.test(name)) parent = 'nuhw';
  if (!parent) continue;
  matched++;

  const fnum = String(f[C.fnum]).trim();
  const id = `${abbr.toLowerCase()}-${fnum}`;
  const reg = f[C.reg] ?? '';
  const record = {
    id,
    number: fnum,
    parent_union: parent,
    name: name.replace(/\s+/g, ' ').trim(),
    city: (f[C.city] ?? '').trim(),
    state: (f[C.state] ?? '').trim(),
    address: (f[C.street] ?? '').trim() || null,
    membership: Math.max(0, Number.parseInt(f[C.members] ?? '0', 10) || 0),
    sectors: sectorsByUnion[parent] ?? [],
    organizing_active: false,
    olms_file_number: fnum,
    fiscal_year: String(year),
  };

  // Dedupe amendments: keep the most recently registered filing per local.
  const existing = byKey.get(id);
  if (!existing || reg > (existing._reg ?? '')) {
    record._reg = reg;
    byKey.set(id, record);
  }
}

const out = [...byKey.values()]
  .map(({ _reg, ...r }) => r)
  .sort((a, b) => a.parent_union.localeCompare(b.parent_union) || b.membership - a.membership);

writeFileSync('data/locals.json', JSON.stringify(out, null, 2) + '\n');
console.log(
  `locals: ${out.length} (matched ${matched}, terminated ${skippedTerminated}, non-LM form ${skippedForm})`,
);
for (const [parent] of Object.entries(PARENTS)) {
  const n = out.filter((r) => r.parent_union === parent).length;
  console.log(`  ${parent}: ${n}`);
}
console.log('  nuhw:', out.filter((r) => r.parent_union === 'nuhw').length);
console.log(`  parents: ${[...new Set(out.map((r) => r.parent_union))].join(', ')}`);
console.log(`  parent names verified: ${[...new Set(out.map((r) => nameByUnion[r.parent_union]))].length}/${Object.keys(nameByUnion).length} directory rows have data`);
