import { describe, expect, it } from 'vitest';

import {
  addDays, addMonths, buildIcs, electionWindow, isoDay, ulpDeadlines,
} from './deadlines';

describe('T7 deadline math', () => {
  it('adds six calendar months across month ends', () => {
    expect(isoDay(addMonths(new Date(2026, 0, 31), 6))).toBe('2026-07-31');
    // Aug 31 + 6 months clamps to Feb 28 / Feb 29 in leap years.
    expect(isoDay(addMonths(new Date(2026, 7, 31), 6))).toBe('2027-02-28');
    expect(isoDay(addMonths(new Date(2027, 7, 31), 6))).toBe('2028-02-29');
  });

  it('ulp deadline: 6 months statutory, file-by 14 days earlier, evidence reminder 14 days', () => {
    const r = ulpDeadlines(new Date(2026, 0, 15)); // Jan 15 2026
    expect(isoDay(r.statutoryDeadline)).toBe('2026-07-15');
    expect(isoDay(r.fileBy)).toBe('2026-07-01');
    expect(r.evidenceWindowDays).toBe(14);
  });

  it('year wrap: December incident -> June deadline next year', () => {
    const r = ulpDeadlines(new Date(2026, 11, 1));
    expect(isoDay(r.statutoryDeadline)).toBe('2027-06-01');
  });

  it('leap-year incident on Feb 29', () => {
    const r = ulpDeadlines(new Date(2028, 1, 29));
    expect(isoDay(r.statutoryDeadline)).toBe('2028-08-29');
  });

  it('election window is the typical 3–6 week band', () => {
    const w = electionWindow(new Date(2026, 5, 1));
    expect(isoDay(w.earliest)).toBe('2026-06-22');
    expect(isoDay(w.latest)).toBe('2026-07-16');
  });

  it('addDays crosses month and year boundaries', () => {
    expect(isoDay(addDays(new Date(2026, 0, 31), 1))).toBe('2026-02-01');
    expect(isoDay(addDays(new Date(2026, 11, 31), 1))).toBe('2027-01-01');
  });

  it('ics output is a valid local VCALENDAR with escaped text', () => {
    const ics = buildIcs([
      { date: new Date(2026, 6, 1), title: 'File ULP; charge', description: 'line1\nline2' },
    ]);
    expect(ics).toContain('BEGIN:VCALENDAR');
    expect(ics).toContain('DTSTART;VALUE=DATE:20260701');
    expect(ics).toContain('SUMMARY:File ULP\\; charge');
    expect(ics).toContain('DESCRIPTION:line1\\nline2');
    expect(ics.endsWith('END:VCALENDAR\r\n')).toBe(true);
  });
});
