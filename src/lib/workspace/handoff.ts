/**
 * Screen 11: Hand off.
 *
 * The committee hands the drive to a union, to EWOC or to a new committee
 * with two things: a CSV the other tools can read, and a plain summary a
 * person can read out loud.
 *
 * The CSV uses the same columns as the R2 CryptPad wall chart, so nothing
 * has to be retyped.
 */
import type * as Y from 'yjs';

import { conversations, expectedSize, people, support } from './view';

export const WALL_CHART_COLUMNS = [
  'Name',
  'Dept',
  'Shift',
  'Language',
  'Rating',
  'Point person',
  'Last contact',
  'Next step',
  'Issues',
] as const;

const RATING_WORDS: Record<number, string> = {
  1: '1 Strong yes',
  2: '2 Leaning yes',
  3: '3 Unsure',
  4: '4 Leaning no',
  5: '5 Against',
};

function csvCell(value: string): string {
  if (/[",\n\r]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

/**
 * The wall chart as CSV. The rating carries its words, because a bare
 * number means nothing to whoever opens the file.
 */
export function wallChartCsv(doc: Y.Doc): string {
  const rows = people(doc).map((person) =>
    [
      person.displayName,
      person.dept,
      person.shift,
      person.language,
      person.rating ? RATING_WORDS[person.rating] : '',
      person.pointPerson ?? '',
      person.lastContact ? person.lastContact.slice(0, 10) : '',
      person.nextStep?.text ?? '',
      person.issues.join(', '),
    ]
      .map(csvCell)
      .join(','),
  );
  // The byte order mark, so Excel opens the file in the right encoding.
  return `\uFEFF${WALL_CHART_COLUMNS.join(',')}\n${rows.join('\n')}\n`;
}

/**
 * The summary a person reads out on a call: where the drive is, what came
 * up, and what to ask for.
 */
export function handoffSummary(doc: Y.Doc): string {
  const all = people(doc);
  const unit = expectedSize(doc);
  const current = support(doc, unit);
  const pct = Math.round(current.pct * 100);
  const rated = all.filter((person) => person.rating !== null).length;
  const untouched = all.filter((person) => person.lastContact === null).length;
  const talks = conversations(doc).length;
  const issueCount = new Map<string, number>();
  for (const person of all) {
    for (const issue of person.issues) {
      issueCount.set(issue, (issueCount.get(issue) ?? 0) + 1);
    }
  }
  const topIssues = [...issueCount.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([issue, count]) => `${issue} (${count})`);

  const lines = [
    `Unit size: ${unit}`,
    `Support: ${current.supporters} of ${unit} (${pct}%)`,
    `Rated 1-2 (strong or leaning yes): ${current.supporters}`,
    `Over the 30% filing floor: ${pct >= 30 ? 'yes' : 'no'}`,
    `Over the 70% go mark: ${pct >= 70 ? 'yes' : 'no'}`,
    `Rated so far: ${rated} of ${all.length}`,
    `Never talked to: ${untouched}`,
    `Conversations logged: ${talks}`,
  ];
  if (topIssues.length > 0) lines.push(`Top issues: ${topIssues.join(', ')}`);
  return lines.join('\n') + '\n';
}

/**
 * Handing off takes a second core member. The check is here so the app
 * cannot forget it.
 */
export function canHandOff(approvals: string[], actorId: string): boolean {
  const distinct = new Set(approvals);
  if (distinct.size < 2) return false;
  return distinct.has(actorId);
}

export type HandoffErrorCode = 'not_enough_approvals' | 'actor_not_approved';

export class HandoffError extends Error {
  readonly code: HandoffErrorCode;

  constructor(code: HandoffErrorCode, message?: string) {
    super(message ?? code);
    this.name = 'HandoffError';
    this.code = code;
  }
}

/** Throws unless a second core member approved. */
export function assertHandoffApproved(approvals: string[], actorId: string): void {
  if (approvals.length < 2) {
    throw new HandoffError('not_enough_approvals', 'a second core member has to approve');
  }
  if (!approvals.includes(actorId)) {
    throw new HandoffError('actor_not_approved', 'the approving member is not in the list');
  }
}
