/**
 * T4 "Is that legal?" decoder logic (plans/03-private-tools.md §T4).
 * Local keyword match — no AI, no server. Entries mirror TIPS/FOE
 * (rights pages) and legal_rule records.
 */

export type Verdict = 'illegal' | 'misleading' | 'legal';

export interface DecoderEntry {
  id: string;
  /** Keyword/synonym stems matched against the worker's text (lowercase). */
  patterns: string[];
  verdict: Verdict;
  /** legal_rule id this maps to (for the as-of status line). */
  rule: string | null;
  replyKey: string;
  logEvidence: boolean;
}

export const ENTRIES: DecoderEntry[] = [
  {
    id: 'close-threat',
    patterns: ['close', 'closing', 'shut down', 'shutdown', 'out of business', 'cer', 'cerrar', 'cierra'],
    verdict: 'illegal',
    rule: 'tips',
    replyKey: 'close-threat',
    logEvidence: true,
  },
  {
    id: 'interrogate',
    patterns: ['who is behind', "who's behind", 'who started', 'who is in', 'which of you', 'quién', 'quien'],
    verdict: 'illegal',
    rule: 'tips',
    replyKey: 'interrogate',
    logEvidence: true,
  },
  {
    id: 'promise-raise',
    patterns: ['raise', 'raise if', 'bonus', 'promotion if', 'aumento', 'bono'],
    verdict: 'illegal',
    rule: 'tips',
    replyKey: 'promise-raise',
    logEvidence: true,
  },
  {
    id: 'watching',
    patterns: ['watching', 'camera', 'followed', 'badge', 'vigilando', 'cámara', 'camara', 'siguiendo'],
    verdict: 'illegal',
    rule: 'tips',
    replyKey: 'watching',
    logEvidence: true,
  },
  {
    id: 'captive-meeting',
    patterns: ['mandatory meeting', 'required meeting', 'meeting about the union', 'one on one with', 'reunión obligatoria', 'reunion obligatoria', 'meeting with hr'],
    verdict: 'misleading',
    rule: 'captive-audience-ban',
    replyKey: 'captive-meeting',
    logEvidence: true,
  },
  {
    id: 'third-party',
    patterns: ['third party', 'outsider', 'union boss', 'tercero', 'ajeno'],
    verdict: 'misleading',
    rule: null,
    replyKey: 'third-party',
    logEvidence: false,
  },
  {
    id: 'we-are-family',
    patterns: ['family', 'team', 'familia', 'equipo'],
    verdict: 'misleading',
    rule: null,
    replyKey: 'we-are-family',
    logEvidence: false,
  },
  {
    id: 'mid-campaign-raise',
    patterns: ['announced a raise', 'gave a raise', 'sudden raise', 'new benefits', 'súbito', 'subita'],
    verdict: 'misleading',
    rule: 'tips',
    replyKey: 'mid-campaign-raise',
    logEvidence: true,
  },
  {
    id: 'foe-opinion',
    patterns: ['i think', 'in my opinion', 'creo', 'mi opinión', 'mi opinion'],
    verdict: 'legal',
    rule: null,
    replyKey: 'foe-opinion',
    logEvidence: false,
  },
  {
    id: 'foe-facts',
    patterns: ['costs the company', 'dues are', 'the union spends', 'strike fund is'],
    verdict: 'legal',
    rule: null,
    replyKey: 'foe-facts',
    logEvidence: false,
  },
];

export interface DecoderMatch {
  entry: DecoderEntry;
  score: number;
}

/** Local keyword match: best-scoring entry, or null when nothing matches.
 *  Score weights by pattern length so 'sudden raise' beats a bare 'raise'. */
export function decode(text: string): DecoderMatch | null {
  const t = text.toLowerCase();
  let best: DecoderMatch | null = null;
  for (const entry of ENTRIES) {
    let score = 0;
    for (const p of entry.patterns) if (t.includes(p)) score += p.length;
    if (score > 0 && (!best || score > best.score)) best = { entry, score };
  }
  return best;
}

/** The worker picked from the seeded list instead of typing. */
export function pick(id: string): DecoderEntry | null {
  return ENTRIES.find((e) => e.id === id) ?? null;
}
