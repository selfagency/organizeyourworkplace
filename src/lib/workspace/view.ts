/**
 * What the screens show, as pure functions over the room document.
 *
 * The screens read these, so the numbers on the phone and the numbers in a
 * test come from the same place. Nothing here is stored: the meter, the
 * counts and the trend are all derived.
 */
import type * as Y from 'yjs';

import {
  actionList,
  conversationArray,
  coworkerMap,
  groupMembers,
  latestRating,
  ratingHistory,
  socialGroups,
  type ActionPlan,
  type ConversationEntry,
  type Rating,
} from './model';

export interface PersonView {
  id: string;
  displayName: string;
  dept: string;
  shift: string;
  language: string;
  rating: Rating | null;
  ratingHistory: { rating: Rating; at: string; by: string }[];
  issues: string[];
  pointPerson: string | null;
  nextStep: { text: string; due: string } | null;
  lastContact: string | null;
  groups: string[];
}

export interface FollowUp {
  coworkerId: string;
  name: string;
  text: string;
  due: string;
}

function text(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}

/** Everyone on the wall chart, with their latest rating and last contact. */
export function people(doc: Y.Doc): PersonView[] {
  const conversations = conversationArray(doc).toArray() as ConversationEntry[];
  const lastByCoworker = new Map<string, string>();
  for (const entry of conversations) {
    const previous = lastByCoworker.get(entry.coworker);
    if (!previous || entry.at > previous) lastByCoworker.set(entry.coworker, entry.at);
  }
  for (const [id, coworker] of coworkerMap(doc)) {
    for (const entry of ratingHistory(coworker as Y.Map<unknown>)) {
      const previous = lastByCoworker.get(id);
      if (!previous || entry.at > previous) lastByCoworker.set(id, entry.at);
    }
  }
  const groupByMember = new Map<string, string[]>();
  for (const group of socialGroups(doc)) {
    for (const memberId of groupMembers(doc, group.id)) {
      groupByMember.set(memberId, [...(groupByMember.get(memberId) ?? []), group.label]);
    }
  }
  const list: PersonView[] = [];
  for (const [id, coworker] of coworkerMap(doc)) {
    const map = coworker as Y.Map<unknown>;
    const history = ratingHistory(map);
    const nextStep = map.get('nextStep') as { text: string; due: string } | undefined;
    list.push({
      id,
      displayName: text(map.get('displayName'), id),
      dept: text(map.get('dept')),
      shift: text(map.get('shift')),
      language: text(map.get('language')),
      rating: latestRating(map),
      ratingHistory: history,
      issues: (map.get('issues') as string[] | undefined) ?? [],
      pointPerson: (map.get('pointPerson') as string | null | undefined) ?? null,
      nextStep: nextStep ?? null,
      lastContact: lastByCoworker.get(id) ?? null,
      groups: groupByMember.get(id) ?? [],
    });
  }
  return list.sort((a, b) => a.displayName.localeCompare(b.displayName));
}

export function conversations(doc: Y.Doc): ConversationEntry[] {
  return (conversationArray(doc).toArray() as ConversationEntry[]).slice().sort((a, b) =>
    a.at < b.at ? 1 : -1,
  );
}

/** The people nobody has talked to yet. */
export function notTalked(doc: Y.Doc): PersonView[] {
  return people(doc).filter((person) => person.lastContact === null);
}

/** Follow-ups that are due today or are late. */
export function dueFollowUps(doc: Y.Doc, today: string): FollowUp[] {
  return people(doc)
    .filter((person) => person.nextStep && person.nextStep.due <= today)
    .map((person) => ({
      coworkerId: person.id,
      name: person.displayName,
      text: person.nextStep!.text,
      due: person.nextStep!.due,
    }))
    .sort((a, b) => a.due.localeCompare(b.due));
}

/** The share of the unit rated 1 or 2, against the expected unit size. */
export function support(doc: Y.Doc, expectedSize: number): { supporters: number; pct: number } {
  const all = people(doc);
  const supporters = all.filter((person) => person.rating === 1 || person.rating === 2).length;
  const pct = expectedSize > 0 ? Math.min(1, supporters / expectedSize) : 0;
  return { supporters, pct };
}

/** The unit size, taken from the document so every device agrees. */
export function expectedSize(doc: Y.Doc): number {
  const unit = doc.getMap('unit');
  const size = unit.get('expectedSize');
  return typeof size === 'number' && size > 0 ? size : people(doc).length;
}

function weekStart(date: Date): string {
  const copy = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const day = copy.getUTCDay();
  const offset = day === 0 ? 6 : day - 1;
  copy.setUTCDate(copy.getUTCDate() - offset);
  return copy.toISOString().slice(0, 10);
}

export interface TrendPoint {
  week: string;
  supporters: number;
  rated: number;
}

/**
 * How many people were rated 1 or 2 at the end of each of the last weeks.
 * The rating history carries the dates, so the trend is derived from it.
 */
export function supportTrend(doc: Y.Doc, now: Date, weeks = 4): TrendPoint[] {
  const all = people(doc);
  const points: TrendPoint[] = [];
  for (let back = weeks - 1; back >= 0; back--) {
    const start = new Date(now.getTime());
    start.setUTCDate(start.getUTCDate() - back * 7);
    const end = new Date(start.getTime());
    end.setUTCDate(end.getUTCDate() + 7);
    let supporters = 0;
    let rated = 0;
    for (const person of all) {
      const inWeek = person.ratingHistory.filter((entry) => {
        const at = entry.at.slice(0, 10);
        return at >= start.toISOString().slice(0, 10) && at < end.toISOString().slice(0, 10);
      });
      if (inWeek.length === 0) continue;
      rated += 1;
      const last = inWeek[inWeek.length - 1]!.rating;
      if (last === 1 || last === 2) supporters += 1;
    }
    points.push({ week: weekStart(start), supporters, rated });
  }
  return points;
}

export interface LeaderNode {
  leaderId: string;
  leaderName: string;
  covers: PersonView[];
  /** More than ten people under one leader is the flag. */
  overworked: boolean;
}

/**
 * Who covers whom. A leader is a member with a group of people under them.
 */
export function leaderTree(doc: Y.Doc, limit = 10): LeaderNode[] {
  const all = people(doc);
  const byId = new Map(all.map((person) => [person.id, person]));
  const nodes = new Map<string, LeaderNode>();
  for (const person of all) {
    const leaderId = person.pointPerson;
    if (!leaderId) continue;
    const node =
      nodes.get(leaderId) ??
      {
        leaderId,
        leaderName: byId.get(leaderId)?.displayName ?? leaderId,
        covers: [],
        overworked: false,
      };
    node.covers.push(person);
    nodes.set(leaderId, node);
  }
  return [...nodes.values()]
    .map((node) => ({ ...node, overworked: node.covers.length > limit }))
    .sort((a, b) => b.covers.length - a.covers.length);
}

export interface GroupCard {
  id: string;
  label: string;
  leader: string | null;
  leaderName: string | null;
  members: PersonView[];
}

/** The social groups, with the people in them. */
export function groupCards(doc: Y.Doc): GroupCard[] {
  const byId = new Map(people(doc).map((person) => [person.id, person]));
  return socialGroups(doc).map((group) => ({
    id: group.id,
    label: group.label,
    leader: group.leader,
    leaderName: group.leader ? (byId.get(group.leader)?.displayName ?? group.leader) : null,
    members: group.members
      .map((memberId) => byId.get(memberId))
      .filter((person): person is PersonView => Boolean(person)),
  }));
}

export interface IssueRank {
  issue: string;
  count: number;
  /** How many raised it, per department. */
  byDepartment: { dept: string; count: number }[];
}

/**
 * The issues, ranked by how many people raised them. The counts are
 * derived, never stored.
 */
export function issueRanking(doc: Y.Doc): IssueRank[] {
  const byIssue = new Map<string, Map<string, number>>();
  for (const person of people(doc)) {
    const dept = person.dept || 'other';
    for (const issue of person.issues) {
      const depts = byIssue.get(issue) ?? new Map<string, number>();
      depts.set(dept, (depts.get(dept) ?? 0) + 1);
      byIssue.set(issue, depts);
    }
  }
  return [...byIssue.entries()]
    .map(([issue, depts]) => ({
      issue,
      count: [...depts.values()].reduce((sum, value) => sum + value, 0),
      byDepartment: [...depts.entries()]
        .map(([dept, count]) => ({ dept, count }))
        .sort((a, b) => b.count - a.count || a.dept.localeCompare(b.dept)),
    }))
    .sort((a, b) => b.count - a.count || a.issue.localeCompare(b.issue));
}

export type WallFilter = 'yes' | 'unassigned' | 'stale';

export interface WallRow {
  dept: string;
  shift: string;
  people: PersonView[];
}

/** The grid rows: department and shift, with the people in them. */
export function wallRows(doc: Y.Doc): WallRow[] {
  const rows = new Map<string, WallRow>();
  for (const person of people(doc)) {
    const key = `${person.dept}|${person.shift}`;
    const row = rows.get(key) ?? { dept: person.dept, shift: person.shift, people: [] };
    row.people.push(person);
    rows.set(key, row);
  }
  return [...rows.values()].sort((a, b) => a.dept.localeCompare(b.dept) || a.shift.localeCompare(b.shift));
}

/** The quick filters on the wall chart. */
export function filterPeople(all: PersonView[], filter: WallFilter, now: Date): PersonView[] {
  const cutoff = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  if (filter === 'yes') return all.filter((person) => person.rating === 1 || person.rating === 2);
  if (filter === 'unassigned') return all.filter((person) => person.rating === null);
  return all.filter((person) => person.lastContact === null || person.lastContact.slice(0, 10) < cutoff);
}

/** The action plans, with the date each one is on. */
export function actions(doc: Y.Doc): ActionPlan[] {
  return actionList(doc);
}
