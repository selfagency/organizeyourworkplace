import { describe, expect, it } from 'vitest';

import {
  addConversation,
  createRoomDoc,
  setIssues,
  setRating,
  upsertCoworker,
} from './model';
import {
  ACTION_BUILDER_HEADERS,
  actionBuilderCsv,
  broadstripesCsv,
  splitName,
  summaryCsv,
} from './handoff-formats';

function docWithPeople(): ReturnType<typeof createRoomDoc> {
  const doc = createRoomDoc();
  upsertCoworker(doc, { id: 'c1', displayName: 'Ana Maria Lopez', dept: 'Dairy', shift: 'Nights', language: 'es' });
  upsertCoworker(doc, { id: 'c2', displayName: 'Rosa', dept: 'Dairy', shift: 'Nights', language: 'es' });
  setRating(doc, 'c1', 2, '2026-10-20', 'm1');
  setIssues(doc, 'c1', ['pay']);
  addConversation(doc, {
    id: 'cv1', coworker: 'c1', by: 'm1', at: '2026-10-20T10:00', to: 2, issues: ['pay'],
    note: 'She is ready\nbut quiet',
  });
  return doc;
}

describe('R3.9 the hand off formats', () => {
  it('splits a name into first and last', () => {
    expect(splitName('Ana Maria Lopez')).toEqual({ first: 'Ana Maria', last: 'Lopez' });
    expect(splitName('Rosa')).toEqual({ first: 'Rosa', last: '' });
  });

  it('uses the Action Builder headers', () => {
    const csv = actionBuilderCsv(docWithPeople());
    const header = csv.split('\n')[0];
    expect(header).toBe(ACTION_BUILDER_HEADERS.join(','));
    expect(header).toContain('Custom ID');
    expect(header).toContain('Assessment');
  });

  it('gives every coworker a custom id that is not their name', () => {
    const doc = docWithPeople();
    const csv = actionBuilderCsv(doc);
    const ids = csv
      .split('\n')
      .slice(1)
      .filter((line) => line.trim())
      .map((line) => line.split(',')[0]);
    expect(ids.every((id) => id.startsWith('w'))).toBe(true);
    expect(ids.join()).not.toContain('Lopez');
  });

  it('keeps the same custom id on a second export', () => {
    const doc = docWithPeople();
    const first = actionBuilderCsv(doc).split('\n')[1]!.split(',')[0];
    const second = actionBuilderCsv(doc).split('\n')[1]!.split(',')[0];
    expect(first).toBe(second);
  });

  it('leaves the notes out unless they are asked for', () => {
    const doc = docWithPeople();
    expect(actionBuilderCsv(doc)).not.toContain('quiet');
    expect(actionBuilderCsv(doc, { includeNotes: true })).toContain('quiet');
  });

  it('never puts a line break inside a field', () => {
    const csv = actionBuilderCsv(docWithPeople(), { includeNotes: true });
    const lines = csv.split('\n');
    // The header, two people, and the empty line after the last row.
    expect(lines.length).toBe(4);
    expect(csv).toContain('She is ready but quiet');
  });

  it('uses the Broadstripes headers with the external system id', () => {
    const csv = broadstripesCsv(docWithPeople());
    const header = csv.split('\n')[0];
    expect(header).toContain('External System ID');
    expect(header).toContain('First Name');
    expect(header).toContain('Last Name');
    expect(header).toContain('Department');
  });

  it('writes the summary with the counts', () => {
    const summary = summaryCsv(docWithPeople());
    expect(summary).toContain('Unit size,2');
    expect(summary).toContain('Support (rated 1 or 2),1');
    expect(summary).toContain('Top issues,pay: 1');
  });
});
