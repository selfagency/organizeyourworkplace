import { describe, expect, it } from 'vitest';

import {
  addConversation,
  addToGroup,
  createRoomDoc,
  setNextStep,
  setPointPerson,
  setRating,
  socialGroups,
  upsertCoworker,
} from './model';
import { dueFollowUps, filterPeople, notTalked, people, support, supportTrend, wallRows } from './view';

const NOW = new Date(Date.UTC(2026, 9, 27, 12, 0, 0));

function docWithPeople(): ReturnType<typeof createRoomDoc> {
  const doc = createRoomDoc();
  upsertCoworker(doc, { id: 'c1', displayName: 'Rosa', dept: 'Dairy', shift: 'nights', language: 'es' });
  upsertCoworker(doc, { id: 'c2', displayName: 'Ana', dept: 'Dairy', shift: 'nights', language: 'es' });
  upsertCoworker(doc, { id: 'c3', displayName: 'Ben', dept: 'Packaging', shift: 'days', language: 'en' });
  return doc;
}

describe('R3.8 the view over the room document', () => {
  it('lists everyone with their latest rating', () => {
    const doc = docWithPeople();
    setRating(doc, 'c1', 2, '2026-10-20', 'm1');
    const all = people(doc);
    expect(all.map((person) => person.displayName)).toEqual(['Ana', 'Ben', 'Rosa']);
    expect(all.find((person) => person.id === 'c1')!.rating).toBe(2);
    expect(all.find((person) => person.id === 'c2')!.rating).toBeNull();
  });

  it('knows who nobody has talked to', () => {
    const doc = docWithPeople();
    addConversation(doc, {
      id: 'cv1', coworker: 'c1', by: 'm1', at: '2026-10-20T10:00', to: 2, issues: ['pay'],
    });
    expect(notTalked(doc).map((person) => person.id)).toEqual(['c2', 'c3']);
  });

  it('knows the last contact date', () => {
    const doc = docWithPeople();
    addConversation(doc, {
      id: 'cv1', coworker: 'c1', by: 'm1', at: '2026-10-20T10:00', to: 2, issues: [],
    });
    addConversation(doc, {
      id: 'cv2', coworker: 'c1', by: 'm1', at: '2026-10-25T10:00', to: 1, issues: [],
    });
    expect(people(doc).find((person) => person.id === 'c1')!.lastContact).toBe('2026-10-25T10:00');
  });

  it('lists the follow-ups that are due', () => {
    const doc = docWithPeople();
    setNextStep(doc, 'c1', { text: 'ask about the petition', due: '2026-10-26' });
    setNextStep(doc, 'c2', { text: 'follow up', due: '2026-10-30' });
    const due = dueFollowUps(doc, '2026-10-27');
    expect(due.map((item) => item.coworkerId)).toEqual(['c1']);
  });

  it('counts the support against the unit size', () => {
    const doc = docWithPeople();
    setRating(doc, 'c1', 1, '2026-10-20', 'm1');
    setRating(doc, 'c2', 2, '2026-10-20', 'm1');
    setRating(doc, 'c3', 5, '2026-10-20', 'm1');
    expect(support(doc, 10)).toEqual({ supporters: 2, pct: 0.2 });
  });

  it('builds the four week trend from the rating history', () => {
    const doc = docWithPeople();
    setRating(doc, 'c1', 1, '2026-10-20', 'm1');
    const points = supportTrend(doc, NOW, 4);
    expect(points).toHaveLength(4);
    expect(points[3]!.week).toBe('2026-10-26');
    expect(points[3]!.supporters).toBe(0);
    expect(points[2]!.week).toBe('2026-10-19');
    expect(points[2]!.supporters).toBe(1);
  });

  it('groups the wall chart by department and shift', () => {
    const doc = docWithPeople();
    const rows = wallRows(doc);
    expect(rows).toHaveLength(2);
    expect(rows[0]!.people.map((person) => person.id)).toEqual(['c2', 'c1']);
  });

  it('filters the wall chart', () => {
    const doc = docWithPeople();
    setRating(doc, 'c1', 1, '2026-10-20', 'm1');
    setPointPerson(doc, 'c3', 'm1');
    const all = people(doc);
    expect(filterPeople(all, 'yes', NOW).map((person) => person.id)).toEqual(['c1']);
    expect(filterPeople(all, 'unassigned', NOW).map((person) => person.id)).toEqual(['c2', 'c3']);
    expect(filterPeople(all, 'stale', NOW).map((person) => person.id)).toEqual(['c2', 'c3']);
  });

  it('keeps the social groups with their members', () => {
    const doc = docWithPeople();
    addToGroup(doc, 'g1', 'Night-shift smokers', 'c1');
    addToGroup(doc, 'g1', 'Night-shift smokers', 'c2');
    const groups = socialGroups(doc);
    expect(groups).toHaveLength(1);
    expect(groups[0]!.label).toBe('Night-shift smokers');
    expect(groups[0]!.members).toEqual(['c1', 'c2']);
  });
});
