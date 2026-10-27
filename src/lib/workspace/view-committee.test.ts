import { describe, expect, it } from 'vitest';

import {
  addAction,
  addToGroup,
  createRoomDoc,
  setIssues,
  setPointPerson,
  upsertCoworker,
} from './model';
import { actions, groupCards, issueRanking, leaderTree } from './view';

function docWithThree(): ReturnType<typeof createRoomDoc> {
  const doc = createRoomDoc();
  upsertCoworker(doc, { id: 'maria', displayName: 'Maria', dept: 'Dairy', shift: 'nights', language: 'es' });
  upsertCoworker(doc, { id: 'c1', displayName: 'Rosa', dept: 'Dairy', shift: 'nights', language: 'es' });
  upsertCoworker(doc, { id: 'c2', displayName: 'Ana', dept: 'Dairy', shift: 'nights', language: 'es' });
  upsertCoworker(doc, { id: 'c3', displayName: 'Ben', dept: 'Packaging', shift: 'days', language: 'en' });
  return doc;
}

describe('R3.8 leaders and coverage', () => {
  it('groups the people under the person who covers them', () => {
    const doc = docWithThree();
    setPointPerson(doc, 'c1', 'maria');
    setPointPerson(doc, 'c2', 'maria');
    const nodes = leaderTree(doc);
    expect(nodes).toHaveLength(1);
    expect(nodes[0]!.leaderName).toBe('Maria');
    expect(nodes[0]!.covers.map((person) => person.id)).toEqual(['c2', 'c1']);
  });

  it('flags a leader who covers more than ten people', () => {
    const doc = createRoomDoc();
    upsertCoworker(doc, { id: 'maria', displayName: 'Maria', dept: 'D', shift: 'n', language: 'en' });
    for (let i = 0; i < 11; i++) {
      const id = `c${i}`;
      upsertCoworker(doc, { id, displayName: id, dept: 'D', shift: 'n', language: 'en' });
      setPointPerson(doc, id, 'maria');
    }
    const nodes = leaderTree(doc);
    expect(nodes[0]!.covers).toHaveLength(11);
    expect(nodes[0]!.overworked).toBe(true);
  });

  it('leaves people with no point person out of the tree', () => {
    const doc = docWithThree();
    expect(leaderTree(doc)).toHaveLength(0);
  });
});

describe('R3.8 social groups', () => {
  it('keeps the group, its leader and its people', () => {
    const doc = docWithThree();
    addToGroup(doc, 'g1', 'Night-shift smokers', 'c1', 'maria');
    addToGroup(doc, 'g1', 'Night-shift smokers', 'c2');
    const cards = groupCards(doc);
    expect(cards).toHaveLength(1);
    expect(cards[0]!.label).toBe('Night-shift smokers');
    expect(cards[0]!.leaderName).toBe('Maria');
    expect(cards[0]!.members.map((person) => person.id)).toEqual(['c1', 'c2']);
  });
});

describe('R3.8 issues', () => {
  it('ranks the issues by how many people raised them', () => {
    const doc = docWithThree();
    setIssues(doc, 'c1', ['pay', 'schedule']);
    setIssues(doc, 'c2', ['pay']);
    setIssues(doc, 'c3', ['safety']);
    const ranked = issueRanking(doc);
    expect(ranked[0]!.issue).toBe('pay');
    expect(ranked[0]!.count).toBe(2);
    expect(ranked[0]!.byDepartment).toEqual([{ dept: 'Dairy', count: 2 }]);
  });

  it('shows the share of each department', () => {
    const doc = docWithThree();
    setIssues(doc, 'c1', ['pay']);
    setIssues(doc, 'c3', ['pay']);
    const ranked = issueRanking(doc);
    expect(ranked[0]!.byDepartment.map((entry) => entry.dept)).toEqual(['Dairy', 'Packaging']);
  });

  it('has nothing to show when no issues were raised', () => {
    expect(issueRanking(docWithThree())).toEqual([]);
  });
});

describe('R3.8 actions', () => {
  it('keeps the action plans in date order', () => {
    const doc = createRoomDoc();
    addAction(doc, { id: 'a2', template: 'march', title: 'March on the boss', roles: ['lead'], goal: 30, date: '2026-11-10' });
    addAction(doc, { id: 'a1', template: 'petition', title: 'Petition', roles: [], goal: 50, date: '2026-11-01' });
    expect(actions(doc).map((action) => action.id)).toEqual(['a1', 'a2']);
  });
});
