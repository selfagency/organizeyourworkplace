// Converts data/unions.csv (union directory v1) into data/unions.json
// records matching src/schemas/records.ts unionSchema.
// Reproducible: node scripts/unions-csv-to-json.mjs
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const csvPath = join(process.cwd(), 'data', 'unions.csv');
const outPath = join(process.cwd(), 'data', 'unions.json');

// --- minimal CSV parser (quoted fields, commas inside quotes) ---
function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      row.push(field);
      field = '';
    } else if (ch === '\n') {
      row.push(field);
      field = '';
      rows.push(row);
      row = [];
    } else if (ch !== '\r') {
      field += ch;
    }
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

function slugify(text) {
  return text
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/** First http(s) URL in a cell, else null. */
function firstUrl(cell) {
  const match = cell.match(/https?:\/\/[^\s()]+/);
  return match ? match[0] : null;
}

function mapStatus(cell) {
  const s = cell.toLowerCase();
  if (s.includes('partially')) return 'partially_verified';
  if (s.includes('to verify') || s.includes('resolve url') || s === 'example') return 'to_verify';
  return 'verified';
}

// Rows whose intake cell holds several unions' links get no single URL;
// the full text moves to intake_note.
const COMPOSITE_SECTOR_PREFIXES = ['Film, TV', 'Airlines'];

const raw = readFileSync(csvPath, 'utf-8');
const rows = parseCsv(raw);
const header = rows[0];
const records = [];
const usedIds = new Set();

for (const cols of rows.slice(1)) {
  const r = Object.fromEntries(header.map((h, i) => [h.trim(), (cols[i] ?? '').trim()]));
  if (!r.union) continue;

  let id;
  const abbr = r.abbreviation;
  if (abbr === 'UAW' && r.sector.startsWith('Higher education')) {
    id = 'uaw-higher-ed';
  } else if (abbr === 'SEIU' && r.sector.startsWith('Building services')) {
    id = 'seiu-building-services';
  } else if (abbr === 'UNITE HERE') {
    id = 'unite-here';
  } else if (abbr === 'WU') {
    id = 'workers-united';
  } else if (abbr === 'IBT') {
    id = 'teamsters';
  } else if (abbr === 'TNG-CWA') {
    id = 'newsguild';
  } else if (abbr === 'NEU-OPEIU') {
    id = 'neu';
  } else if (abbr === 'AFSCME CWU') {
    id = 'afscme-cwu';
  } else if (abbr === 'NABTU') {
    id = 'nabtu';
  } else if (abbr === 'various' || abbr.startsWith('AFA')) {
    id = r.sector.startsWith('Film')
      ? 'film-tv-arts-unions'
      : r.sector.startsWith('Airlines')
        ? 'airline-unions'
        : 'independent-unions';
  } else {
    id = slugify(abbr);
  }
  if (usedIds.has(id)) throw new Error(`Duplicate id ${id}`);
  usedIds.add(id);

  const composite = COMPOSITE_SECTOR_PREFIXES.some((p) => r.sector.startsWith(p));
  const intakeUrl = composite ? null : firstUrl(r.organizing_intake);
  const intakeCellIsUrlOnly = intakeUrl !== null && r.organizing_intake.startsWith(intakeUrl);
  const note = r.organizing_intake && !intakeCellIsUrlOnly ? r.organizing_intake : undefined;

  const finderUrl = firstUrl(r.local_finder ?? '');
  const finderCellIsUrlOnly = finderUrl !== null && (r.local_finder ?? '').startsWith(finderUrl);

  records.push({
    id,
    name: r.union,
    abbreviation: abbr,
    affiliation: r.affiliation,
    sectors: [slugify(r.sector)],
    who_they_organize: r.who_they_organize,
    organizing_intake: intakeUrl,
    intake_note: note,
    local_finder: finderCellIsUrlOnly ? finderUrl : null,
    local_finder_note:
      r.local_finder && !finderCellIsUrlOnly && r.local_finder !== 'TO VERIFY'
        ? r.local_finder
        : undefined,
    recent_wins: [],
    recent_example: r.recent_example || undefined,
    status: mapStatus(r.status),
    last_checked: r.last_checked,
    sources: [],
  });
}

writeFileSync(outPath, `${JSON.stringify(records, null, 2)}\n`);
console.log(`Wrote ${records.length} union records to ${outPath}`);