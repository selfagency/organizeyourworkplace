import { describe, expect, it } from 'vitest';

import {
  addConversation,
  createRoomDoc,
  setIssues,
  setNextStep,
  setPointPerson,
  setRating,
  upsertCoworker,
} from './model';
import {
  assertHandoffApproved,
  canHandOff,
  handoffSummary,
  HandoffError,
  wallChartCsv,
  WALL_CHART_COLUMNS,
} from './handoff';

function docWithPeople(): ReturnType<typeof createRoomDoc> {
  const doc = createRoomDoc();
  upsertCoworker(doc, { id: 'c1', displayName: 'Rosa', dept: 'Dairy', shift: 'Nights', language: 'es' });
  upsertCoworker(doc, { id: 'c2', displayName: 'Ana "Annie"', dept: 'Dairy', shift: 'Nights', language: 'es' });
  upsertCoworker(doc, { id: 'c3', displayName: 'Ben', dept: 'Packaging', shift: 'Days', language: 'en' });
  setRating(doc, 'c1', 2, '2026-10-20', 'm1');
  setRating(doc, 'c2', 1, '2026-10-21', 'm1');
  setIssues(doc, 'c1', ['pay', 'schedule']);
  setIssues(doc, 'c2', ['pay']);
  setPointPerson(doc, 'c1', 'maria');
  setNextStep(doc, 'c1', { text: 'ask about the petition', due: '2026-10-30' });
  addConversation(doc, {
    id: 'cv1', coworker: 'c1', by: 'm1', at: '2026-10-20T10:00', to: 2, issues: ['pay'],
  });
  return doc;
}

describe('R3.8 hand off the CSV', () => {
  it('uses the columns of the R2 wall chart', () => {
    const csv = wallChartCsv(docWithPeople());
    const header = csv.replace(/^\uFEFF/, '').split('\n')[0];
    expect(header).toBe('Name,Dept,Shift,Language,Rating,Point person,Last contact,Next step,Issues');
    expect(WALL_CHART_COLUMNS).toHaveLength(9);
  });

  it('writes the rating with its words', () => {
    const csv = wallChartCsv(docWithPeople());
    expect(csv).toContain('2 Leaning yes');
    expect(csv).toContain('1 Strong yes');
  });

  it('quotes a name with a comma in it', () => {
    const csv = wallChartCsv(docWithPeople());
    expect(csv).toContain('"Ana ""Annie"""');
  });

  it('keeps the point person, the last contact and the next step', () => {
    const csv = wallChartCsv(docWithPeople());
    expect(csv).toContain('maria');
    expect(csv).toContain('2026-10-20');
    expect(csv).toContain('ask about the petition');
  });

  it('leaves the rating empty for a coworker nobody talked to', () => {
    const csv = wallChartCsv(docWithPeople());
    const ben = csv.split('\n').find((line) => line.startsWith('Ben'))!;
    expect(ben.split(',')[4]).toBe('');
  });
});

describe('R3.8 hand off the summary', () => {
  it('says where the drive is', () => {
    const summary = handoffSummary(docWithPeople());
    expect(summary).toContain('Unit size: 3');
    expect(summary).toContain('Support: 2 of 3 (67%)');
    expect(summary).toContain('Over the 30% filing floor: yes');
    expect(summary).toContain('Over the 70% go mark: no');
  });

  it('lists the top issues', () => {
    expect(handoffSummary(docWithPeople())).toContain('Top issues: pay (2)');
  });

  it('counts who nobody talked to', () => {
    expect(handoffSummary(docWithPeople())).toContain('Never talked to: 1');
  });
});

describe('R3.8 hand off needs a second core member', () => {
  it('refuses one approval', () => {
    expect(canHandOff(['maria'], 'maria')).toBe(false);
  });

  it('allows two approvals, one of them the member doing it', () => {
    expect(canHandOff(['maria', 'sam'], 'maria')).toBe(true);
  });

  it('throws when the second approval is missing', () => {
    expect(() => assertHandoffApproved(['maria'], 'maria')).toThrow(HandoffError);
  });

  it('throws when the member doing it is not among the approvers', () => {
    expect(() => assertHandoffApproved(['maria', 'sam'], 'lee')).toThrow(HandoffError);
  });
});
