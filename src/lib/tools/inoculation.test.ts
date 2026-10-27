import { describe, expect, it } from 'vitest';

import { buildSheet, MOVES, sheetText } from './inoculation';

describe('T6 inoculation', () => {
  it('builds a sheet only for picked moves, deduped, in pick order', () => {
    const sheet = buildSheet(['dues-scare', 'captive-meeting', 'dues-scare'], 'en');
    expect(sheet.map((s) => s.move)).toEqual(['dues-scare', 'captive-meeting']);
    expect(sheet[0].truth).toContain('vote');
  });

  it('emits both languages for every move', () => {
    for (const m of MOVES) {
      const [en] = buildSheet([m], 'en');
      const [es] = buildSheet([m], 'es');
      expect(en.say).toBeTruthy();
      expect(en.truth).toBeTruthy();
      expect(es.say).toBeTruthy();
      expect(es.truth).toBeTruthy();
    }
  });

  it('plain-text sheet has a title and one bullet per move', () => {
    const text = sheetText(buildSheet(['delay', 'letters-emails'], 'es'), 'es');
    expect(text.startsWith('LO QUE DIRÁN')).toBe(true);
    expect(text.match(/• /g)).toHaveLength(2);
  });

  it('empty pick makes an empty sheet', () => {
    expect(buildSheet([], 'en')).toEqual([]);
  });
});
