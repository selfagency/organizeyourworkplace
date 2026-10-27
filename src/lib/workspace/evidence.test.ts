import { describe, expect, it } from 'vitest';

import { addEvidence, createRoomDoc } from './model';
import { evidenceCsv, evidenceTimeline, formatBytes, lockerItems, MAX_FILE_BYTES } from './evidence';

function docWithEvidence(): ReturnType<typeof createRoomDoc> {
  const doc = createRoomDoc();
  addEvidence(doc, {
    id: 'e1', at: '2026-10-02', kind: 'incident', description: 'Shift cut by two hours',
    by: 'maria',
  });
  addEvidence(doc, {
    id: 'e2', at: '2026-10-20', kind: 'photo', description: 'The schedule on the board',
    fileName: 'schedule.jpg', by: 'sam',
  });
  return doc;
}

describe('R3.8 the evidence locker', () => {
  it('keeps the items in date order', () => {
    const items = lockerItems(docWithEvidence());
    expect(items.map((item) => item.id)).toEqual(['e1', 'e2']);
  });

  it('writes a timeline with the dates first', () => {
    const timeline = evidenceTimeline(lockerItems(docWithEvidence()));
    const lines = timeline.trim().split('\n');
    expect(lines[0]).toContain('2026-10-02');
    expect(lines[0]).toContain('Shift cut by two hours');
    expect(lines[1]).toContain('schedule.jpg');
  });

  it('writes a CSV for a case file', () => {
    const csv = evidenceCsv(lockerItems(docWithEvidence()));
    const lines = csv.replace(/^\uFEFF/, '').trim().split('\n');
    expect(lines[0]).toBe('Date,Kind,What happened,File,Added by');
    expect(lines[1]).toContain('2026-10-02,Incident,Shift cut by two hours');
  });

  it('has nothing to export from an empty locker', () => {
    expect(evidenceTimeline(lockerItems(createRoomDoc()))).toBe('');
  });

  it('caps the size of a file', () => {
    expect(MAX_FILE_BYTES).toBeLessThanOrEqual(2 * 1024 * 1024);
  });

  it('says the size in plain words', () => {
    expect(formatBytes(500)).toBe('500 B');
    expect(formatBytes(2048)).toBe('2 KB');
  });
});
