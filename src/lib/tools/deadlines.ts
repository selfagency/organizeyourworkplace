/**
 * T7 Deadline calculator logic (plans/03-private-tools.md §T7).
 * Pure date math — all local time, no time zones, no network.
 * Rules live in legal_rule records at build time; these constants mirror
 * legal-rules.json (ulp-evidence-window, GC 26-01) and 10(b).
 */

export const ULP_MONTHS = 6;
/** Evidence is due within two weeks of docketing (GC 26-01, Dec 2025). */
export const EVIDENCE_DAYS = 14;
/** Recommended safety buffer before the statutory deadline. */
export const BUFFER_DAYS = 14;
/** Typical uncontested election window after a petition (estimate only). */
export const ELECTION_MIN_DAYS = 21;
export const ELECTION_MAX_DAYS = 45;

/** Add calendar months, clamping to month end (Jan 31 + 6mo -> Jul 31; Aug 31 -> Feb 28/29). */
export function addMonths(date: Date, months: number): Date {
  const y = date.getFullYear();
  const m = date.getMonth() + months;
  const d = date.getDate();
  const target = new Date(y, m, 1);
  const lastDay = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate();
  return new Date(y, m, Math.min(d, lastDay));
}

export function addDays(date: Date, days: number): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);
}

export interface UlpResult {
  incident: Date;
  /** Statutory last day to file (10(b): 6 months). */
  statutoryDeadline: Date;
  /** Recommended file-by date (buffer applied). */
  fileBy: Date;
  /** Evidence due within two weeks of filing — shown as a checklist reminder. */
  evidenceWindowDays: number;
}

export function ulpDeadlines(incident: Date): UlpResult {
  const statutoryDeadline = addMonths(incident, ULP_MONTHS);
  const fileBy = addDays(statutoryDeadline, -BUFFER_DAYS);
  return { incident, statutoryDeadline, fileBy, evidenceWindowDays: EVIDENCE_DAYS };
}

export interface ElectionEstimate {
  petition: Date;
  earliest: Date;
  latest: Date;
}

/** Rough election window from the petition date. Estimate — confirm with the region. */
export function electionWindow(petition: Date): ElectionEstimate {
  return {
    petition,
    earliest: addDays(petition, ELECTION_MIN_DAYS),
    latest: addDays(petition, ELECTION_MAX_DAYS),
  };
}

/** YYYY-MM-DD in local time (no UTC drift). */
export function isoDay(date: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${p(date.getMonth() + 1)}-${p(date.getDate())}`;
}

function icsEscape(text: string): string {
  return text.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n');
}

/** Generate a local .ics (VCALENDAR) string. No calendar API, no network. */
export function buildIcs(events: { date: Date; title: string; description?: string }[]): string {
  const stamp = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  const fmt = (d: Date) =>
    `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}T090000`;
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//organizeyourworkplace//deadlines//EN',
    'CALSCALE:GREGORIAN',
  ];
  events.forEach((e, i) => {
    lines.push(
      'BEGIN:VEVENT',
      `UID:oyw-${stamp.getTime()}-${i}@local`,
      `DTSTAMP:${fmt(stamp)}Z`,
      `DTSTART;VALUE=DATE:${fmt(e.date).slice(0, 8)}`,
      `SUMMARY:${icsEscape(e.title)}`,
      ...(e.description ? [`DESCRIPTION:${icsEscape(e.description)}`] : []),
      'END:VEVENT',
    );
  });
  lines.push('END:VCALENDAR');
  return lines.join('\r\n') + '\r\n';
}
