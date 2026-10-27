import { describe, expect, it } from 'vitest';

import { buildScript, ISSUES, scriptText } from './conversation';

describe('T5 conversation builder', () => {
  it('covers the full six-step sequence plus follow-up, per issue', () => {
    const [s] = buildScript(['pay'], 'en');
    expect(s.steps.map((x) => x.key)).toEqual([
      'Listen', 'Dig', 'Agitate', 'Plan', 'Inoculate', 'Ask', 'Follow up',
    ]);
  });

  it('opener asks about the problem, never the word union', () => {
    const [s] = buildScript(['scheduling'], 'en');
    expect(s.steps[0].text).toMatch(/[Ss]cheduling/);
    expect(s.steps[0].text.toLowerCase()).not.toContain('union');
  });

  it('dedupes issues and keeps order; both languages complete', () => {
    const scripts = buildScript(['pay', 'safety', 'pay'], 'es');
    expect(scripts).toHaveLength(2);
    for (const s of scripts) {
      for (const st of s.steps) expect(st.text.length).toBeGreaterThan(10);
    }
  });

  it('every issue has both-language copy', () => {
    for (const issue of ISSUES) {
      expect(buildScript([issue], 'en')[0].steps[0].text).toBeTruthy();
      expect(buildScript([issue], 'es')[0].steps[0].text).toBeTruthy();
    }
  });

  it('scriptText is printable with title and step lines', () => {
    const text = scriptText(buildScript(['pay'], 'en'), 'en');
    expect(text.startsWith('FIRST-CONVERSATION SCRIPT')).toBe(true);
    expect(text).toContain('Listen:');
    expect(text).toContain('Follow up:');
  });
});
