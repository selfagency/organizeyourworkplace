/**
 * R3.3 workspace data model on Yjs (04-workspace-app.md §Data model).
 * One Y.Doc per room. Derived values (meter, counts) are computed here,
 * never stored in the document.
 * Deniability (05-security §Deniable edits): updates are MAC'd with the
 * room key (see ./envelope). No per-device signatures anywhere.
 */
import * as Y from 'yjs';

export type Rating = 1 | 2 | 3 | 4 | 5;

export interface CoworkerSeed {
  id: string;
  displayName: string;
  dept: string;
  shift: string;
  language: string;
}

export interface ConversationEntry {
  id: string;
  coworker: string;
  by: string;
  at: string;
  from?: Rating;
  to: Rating;
  issues: string[];
  note?: string;
  nextStep?: string;
}

export const createRoomDoc = (): Y.Doc => new Y.Doc();

export const coworkerMap = (doc: Y.Doc): Y.Map<Y.Map<unknown>> => doc.getMap('coworkers');
export const conversationArray = (doc: Y.Doc): Y.Array<unknown> => doc.getArray('conversations');
export const issueMap = (doc: Y.Doc): Y.Map<string> => doc.getMap('issues');
export const groupMap = (doc: Y.Doc): Y.Map<string> => doc.getMap('groups');

export function upsertCoworker(doc: Y.Doc, seed: CoworkerSeed): Y.Map<unknown> {
  const map = coworkerMap(doc);
  let c = map.get(seed.id);
  if (!c) {
    c = new Y.Map();
    map.set(seed.id, c);
  }
  const existing = c as Y.Map<unknown>;
  existing.set('displayName', seed.displayName);
  existing.set('dept', seed.dept);
  existing.set('shift', seed.shift);
  existing.set('language', seed.language);
  if (!existing.get('ratingHistory')) existing.set('ratingHistory', new Y.Array());
  return existing;
}

/** Append-only rating history: the old value is never overwritten. */
export function setRating(doc: Y.Doc, id: string, rating: Rating, at: string, by: string): void {
  const c = coworkerMap(doc).get(id);
  if (!c) throw new Error(`unknown coworker ${id}`);
  const hist = c.get('ratingHistory') as Y.Array<unknown>;
  hist.push([{ rating, at, by }]);
}

export function addConversation(doc: Y.Doc, entry: ConversationEntry): void {
  conversationArray(doc).push([entry]);
}

export interface MajorityMeter {
  /** rated 1–2 */
  supporters: number;
  /** rated coworkers */
  total: number;
  /** expected unit size (from the Unit record) */
  expected: number;
  pct: number;
  floor30: boolean;
  go70: boolean;
}

/** Computed on demand — the spec stores expectedSize only. */
export function majorityMeter(doc: Y.Doc, expectedSize: number): MajorityMeter {
  let supporters = 0;
  let total = 0;
  for (const c of coworkerMap(doc).values()) {
    const hist = c.get('ratingHistory') as Y.Array<{ rating: Rating }> | undefined;
    if (!hist || hist.length === 0) continue;
    total++;
    const last = hist.length ? hist.get(hist.length - 1).rating : null;
    if (last === 1 || last === 2) supporters++;
  }
  const pct = expectedSize > 0 ? supporters / expectedSize : 0;
  return { supporters, total, expected: expectedSize, pct, floor30: pct >= 0.3, go70: pct >= 0.7 };
}
