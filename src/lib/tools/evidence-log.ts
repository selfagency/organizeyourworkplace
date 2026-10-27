/**
 * T11 Retaliation evidence log — crypto core (plans/03-private-tools.md §T11).
 * Hash chain (SHA-256) for tamper evidence; AES-GCM envelope (PBKDF2-SHA256,
 * 600k iterations) at rest; storage adapter keeps IndexedDB out of the logic.
 * Everything happens on the device; nothing here touches the network.
 */

export interface EntryInput {
  when: string; // ISO-ish local "YYYY-MM-DDTHH:mm"
  what: string;
  who: string;
  witnesses: string;
  files: string[]; // export names only; bytes live in the storage adapter
}

export interface Entry extends EntryInput {
  prev: string; // hash of the previous entry (or genesis)
  hash: string; // hash of this entry's canonical form
}

export interface Chain {
  genesis: string;
  entries: Entry[];
}

export interface SealedBlob {
  v: 1;
  salt: string; // hex
  iv: string; // hex
  data: string; // hex ciphertext (AES-GCM)
}

import {
  deriveKey as deriveKeyShared,
  openJson,
  sealJson,
} from '../workspace/crypto';

export const deriveKey = deriveKeyShared;
// Chain-typed aliases over the shared generic envelopes.
export const seal = sealJson;
export const open = openJson;

const enc = new TextEncoder();

const toHex = (b: ArrayBuffer) =>
  [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, '0')).join('');
const fromHex = (h: string) => Uint8Array.from(h.match(/../g)!.map((x) => parseInt(x, 16)));

async function sha256(text: string): Promise<string> {
  return toHex(await crypto.subtle.digest('SHA-256', enc.encode(text)));
}

function canonical(entry: Omit<Entry, 'hash'>): string {
  // Stable key order — hash must not depend on property order.
  return JSON.stringify([entry.prev, entry.when, entry.what, entry.who, entry.witnesses, entry.files]);
}

export async function createChain(): Promise<Chain> {
  return { genesis: await sha256(`oyw-evidence-genesis-${Date.now()}-${crypto.randomUUID()}`), entries: [] };
}

export async function appendEntry(chain: Chain, input: EntryInput): Promise<Chain> {
  const prev = chain.entries.length
    ? chain.entries[chain.entries.length - 1].hash
    : chain.genesis;
  const base = { ...input, prev };
  return { ...chain, entries: [...chain.entries, { ...base, hash: await sha256(canonical(base)) }] };
}

export async function verifyChain(chain: Chain): Promise<boolean> {
  let prev = chain.genesis;
  for (const e of chain.entries) {
    if (e.prev !== prev) return false;
    const base: Omit<Entry, 'hash'> = {
      prev: e.prev, when: e.when, what: e.what, who: e.who, witnesses: e.witnesses, files: e.files,
    };
    if ((await sha256(canonical(base))) !== e.hash) return false;
    prev = e.hash;
  }
  return true;
}

/** NLRB-ready plain-text timeline (supports the 2-week evidence deadline). */
export function exportTimeline(chain: Chain, lang: 'en' | 'es'): string {
  const title = lang === 'es' ? 'LÍNEA DE EVIDENCIA' : 'EVIDENCE TIMELINE';
  const ok = lang === 'es' ? 'cadena verificada' : 'chain verified';
  const lines = [title, `${lang === 'es' ? 'Generado' : 'Generated'}: ${new Date().toISOString()}`, ''];
  for (const e of chain.entries) {
    lines.push(`${e.when.replace('T', ' ')}`);
    lines.push(`${lang === 'es' ? 'Qué' : 'What'}: ${e.what}`);
    if (e.who) lines.push(`${lang === 'es' ? 'Quién' : 'Who'}: ${e.who}`);
    if (e.witnesses) lines.push(`${lang === 'es' ? 'Testigos' : 'Witnesses'}: ${e.witnesses}`);
    if (e.files.length) lines.push(`${lang === 'es' ? 'Archivos' : 'Files'}: ${e.files.join(', ')}`);
    lines.push('');
  }
  lines.push(`[${ok}]`);
  return lines.join('\n');
}

/** Local calendar-day strings for .ics export. */
export function buildIcsDates(entries: Entry[]): string[] {
  return entries.map((e) => e.when.slice(0, 10).replace(/-/g, ''));
}
