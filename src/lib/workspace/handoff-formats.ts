/**
 * Screen 11: Hand off, in the two formats the union tools read
 * (04-workspace-app.md §Hand-off export formats).
 *
 * This is the one moment the data leaves the encrypted system as readable
 * text. It needs a second core member, it is made on the device, and we
 * never upload it.
 */
import type * as Y from 'yjs';

import { conversations, expectedSize, people, support } from './view';

export const ACTION_BUILDER_HEADERS = [
  'Custom ID',
  'First Name',
  'Last Name',
  'Email',
  'Phone Number',
  'Preferred Language',
  'Assessment',
  'Note',
  'Note Date',
  'Shift Field Response',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
  'Sunday',
] as const;

export const BROADSTRIPES_HEADERS = [
  'External System ID',
  'First Name',
  'Last Name',
  'Preferred Language',
  'Assessment',
  'Department',
  'Classification',
  'Work location',
  'Issues',
  'Social groups',
  'Note',
  'Note Date',
] as const;

/** The fields Action Builder and Broadstripes both read. */
export const FIELD_SETUP_NOTE = [
  'Set these up in the campaign first, or the values will not import:',
  '- Department: the exact names you use in the campaign.',
  '- Assessment: the words, not the number. 1 Strong yes, 2 Leaning yes,',
  '  3 Unsure, 4 Leaning no, 5 Against.',
  '- Shift Field Response: the shifts in your campaign.',
  '- Names: the split is at the last space. Ana Maria Lopez Garcia ships',
  '  as first "Ana Maria Lopez", last "Garcia". Fix a compound surname in',
  '  the campaign after the import if it files wrong.',
  'The Custom ID stays the same on every export, so a second export',
  'updates the people instead of making them twice.',
].join('\n');

function csvCell(value: string): string {
  // No line breaks inside a field: Action Builder breaks on them.
  const flat = value.replace(/[\r\n]+/g, ' ');
  if (/[",]/.test(flat)) return `"${flat.replace(/"/g, '""')}"`;
  return flat;
}

function csvRow(values: (string | number)[]): string {
  return values.map((value) => csvCell(String(value))).join(',');
}

/** "Ana Maria Lopez" becomes first "Ana" and last "Lopez". */
export function splitName(displayName: string): { first: string; last: string } {
  const parts = displayName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { first: '', last: '' };
  if (parts.length === 1) return { first: parts[0]!, last: '' };
  return { first: parts.slice(0, -1).join(' '), last: parts[parts.length - 1]! };
}

export interface ExportOptions {
  /** Notes stay out unless the organizer asked for them. */
  includeNotes?: boolean;
}

function noteText(doc: Y.Doc, id: string, includeNotes: boolean): { note: string; date: string } {
  if (!includeNotes) return { note: '', date: '' };
  // conversations() sorts newest first, so the first hit is the latest
  // note. If that sort ever changes, so does the export.
  const talk = conversations(doc).find((entry) => entry.coworker === id && entry.note);
  if (!talk?.note) return { note: '', date: '' };
  return { note: talk.note, date: talk.at.slice(0, 10) };
}

/** The Action Builder upload file. */
export function actionBuilderCsv(doc: Y.Doc, options: ExportOptions = {}): string {
  const rows = people(doc).map((person) => {
    const { first, last } = splitName(person.displayName);
    const { note, date } = noteText(doc, person.id, options.includeNotes === true);
    return csvRow([
      person.customId,
      first,
      last,
      '',
      '',
      person.language,
      person.rating ?? '',
      note,
      date,
      person.shift,
      '',
      '',
      '',
      '',
      '',
      '',
    ]);
  });
  return `${csvRow([...ACTION_BUILDER_HEADERS])}\n${rows.join('\n')}\n`;
}

/** The Broadstripes upload file. It reads the first sheet of a CSV. */
export function broadstripesCsv(doc: Y.Doc, options: ExportOptions = {}): string {
  const rows = people(doc).map((person) => {
    const { first, last } = splitName(person.displayName);
    const { note, date } = noteText(doc, person.id, options.includeNotes === true);
    return csvRow([
      person.customId,
      first,
      last,
      person.language,
      person.rating ?? '',
      person.dept,
      person.shift,
      '',
      person.issues.join(', '),
      person.groups.join(', '),
      note,
      date,
    ]);
  });
  return `${csvRow([...BROADSTRIPES_HEADERS])}\n${rows.join('\n')}\n`;
}

/** The summary sheet: counts by rating and department, the top issues. */
export function summaryCsv(doc: Y.Doc): string {
  const all = people(doc);
  const unit = expectedSize(doc);
  const current = support(doc, unit);
  const byRating = [1, 2, 3, 4, 5].map(
    (rating) => `${rating}: ${all.filter((person) => person.rating === rating).length}`,
  );
  const departments = [...new Set(all.map((person) => person.dept).filter(Boolean))].sort();
  const byDepartment = departments.map(
    (dept) =>
      `${dept}: ${all.filter((person) => person.dept === dept && (person.rating === 1 || person.rating === 2)).length} of ${
        all.filter((person) => person.dept === dept).length
      }`,
  );
  const issues = new Map<string, number>();
  for (const person of all) {
    for (const issue of person.issues) issues.set(issue, (issues.get(issue) ?? 0) + 1);
  }
  const topIssues = [...issues.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([issue, count]) => `${issue}: ${count}`);

  const rows = [
    csvRow(['Measure', 'Value']),
    csvRow(['Unit size', unit]),
    csvRow(['Support (rated 1 or 2)', current.supporters]),
    csvRow(['Support percent', `${Math.round(current.pct * 100)}%`]),
    csvRow(['Over the 30% filing floor', current.pct >= 0.3 ? 'yes' : 'no']),
    csvRow(['Over the 70% go mark', current.pct >= 0.7 ? 'yes' : 'no']),
    csvRow(['People on the chart', all.length]),
    csvRow(['Count by rating', byRating.join(' / ')]),
    csvRow(['Support by department', byDepartment.join(' / ')]),
    csvRow(['Top issues', topIssues.join(' / ')]),
    csvRow(['Conversations logged', conversations(doc).length]),
  ];
  return rows.join('\n') + '\n';
}
