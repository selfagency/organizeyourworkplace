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
export const groupMap = (doc: Y.Doc): Y.Map<unknown> => doc.getMap('groups');

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

export interface NextStep {
  text: string;
  due: string;
}

/** The issues this coworker has raised. */
export function setIssues(doc: Y.Doc, id: string, issues: string[]): void {
  const c = coworkerMap(doc).get(id);
  if (!c) throw new Error(`unknown coworker ${id}`);
  c.set('issues', issues);
}

/** The organizer who covers this coworker. */
export function setPointPerson(doc: Y.Doc, id: string, pointPersonId: string | null): void {
  const c = coworkerMap(doc).get(id);
  if (!c) throw new Error(`unknown coworker ${id}`);
  c.set('pointPerson', pointPersonId);
}

/** What happens next, and when it is due. */
export function setNextStep(doc: Y.Doc, id: string, step: NextStep | null): void {
  const c = coworkerMap(doc).get(id);
  if (!c) throw new Error(`unknown coworker ${id}`);
  c.set('nextStep', step);
}

/** The latest rating of a coworker, or null when nobody talked to them yet. */
export function latestRating(coworker: Y.Map<unknown>): Rating | null {
  const history = coworker.get('ratingHistory') as Y.Array<{ rating: Rating }> | undefined;
  if (!history || history.length === 0) return null;
  return history.get(history.length - 1).rating;
}

/** Every rating this coworker ever had, oldest first. */
export function ratingHistory(coworker: Y.Map<unknown>): { rating: Rating; at: string; by: string }[] {
  const history = coworker.get('ratingHistory') as Y.Array<{ rating: Rating; at: string; by: string }> | undefined;
  if (!history) return [];
  return history.toArray();
}

/** Adds a coworker to a social group, and creates the group if it is new. */
export function addToGroup(
  doc: Y.Doc,
  groupId: string,
  label: string,
  memberId: string,
  leaderId?: string,
): void {
  const groups = groupMap(doc);
  if (!groups.get(groupId)) {
    groups.set(groupId, label);
  }
  const members = (groups.get(`${groupId}:members`) as string[] | undefined) ?? [];
  if (!members.includes(memberId)) {
    groups.set(`${groupId}:members`, [...members, memberId]);
  }
  if (leaderId) {
    groups.set(`${groupId}:leader`, leaderId);
  }
}

/** The members of a social group. */
export function groupMembers(doc: Y.Doc, groupId: string): string[] {
  return (groupMap(doc).get(`${groupId}:members`) as string[] | undefined) ?? [];
}

/** Every social group with its label, its leader and its members. */
export function socialGroups(doc: Y.Doc): {
  id: string;
  label: string;
  leader: string | null;
  members: string[];
}[] {
  const groups = groupMap(doc);
  const out: { id: string; label: string; leader: string | null; members: string[] }[] = [];
  for (const [key, value] of groups) {
    if (key.endsWith(':members')) continue;
    if (key.endsWith(':leader')) continue;
    out.push({
      id: key,
      label: String(value),
      leader: (groups.get(`${key}:leader`) as string | undefined) ?? null,
      members: groupMembers(doc, key),
    });
  }
  return out;
}

export type ActionTemplate = 'petition' | 'march' | 'button_day' | 'other';

export interface ActionPlan {
  id: string;
  template: ActionTemplate;
  title: string;
  roles: string[];
  goal: number;
  date: string;
  debrief?: string;
}

/** The action plans: a petition, a march, a button day. */
export function addAction(doc: Y.Doc, action: ActionPlan): void {
  doc.getArray('actions').push([action]);
}

export function actionList(doc: Y.Doc): ActionPlan[] {
  return (doc.getArray('actions').toArray() as ActionPlan[]).slice().sort((a, b) =>
    a.date < b.date ? -1 : 1,
  );
}

/** The members of the committee, and the ones who lead a group of people. */
export function setLeader(doc: Y.Doc, memberId: string, leaderId: string | null): void {
  const leaders = doc.getMap('leaders');
  if (leaderId === null) {
    leaders.delete(memberId);
    return;
  }
  leaders.set(memberId, leaderId);
}

export function leaderMap(doc: Y.Doc): Y.Map<string> {
  return doc.getMap('leaders');
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
