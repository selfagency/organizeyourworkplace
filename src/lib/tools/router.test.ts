import { describe, expect, it } from 'vitest';

import { ewocPayload, route, type RouterAnswers } from './router';

const base: RouterAnswers = {
  employer: 'company',
  talked: 'no',
  punished: false,
  union: 'no',
};

describe('T1 router', () => {
  it('Q4 = yes always routes to retaliation, over every other answer', () => {
    for (const employer of ['company', 'nonprofit', 'airline-rail', 'church', 'government'] as const) {
      for (const talked of ['no', 'few', 'committee'] as const) {
        for (const union of ['no', 'drive', 'union'] as const) {
          const r = route({ ...base, employer, talked, union, punished: true });
          expect(r.href).toBe('/help/retaliation');
          expect(r.ewoc).toBe(true);
        }
      }
    }
  });

  it('government routes to coverage with out-of-scope notice and no EWOC handoff', () => {
    const r = route({ ...base, employer: 'government' });
    expect(r.href).toBe('/rights/am-i-covered');
    expect(r.notice).toBe('government');
    expect(r.ewoc).toBe(false);
  });

  it('airline/rail routes to the RLA page', () => {
    expect(route({ ...base, employer: 'airline-rail' }).href).toBe('/rights/am-i-covered/airlines-rail');
  });

  it('church-run routes to the religious exemption page', () => {
    expect(route({ ...base, employer: 'church' }).href).toBe('/rights/am-i-covered/religious-employers');
  });

  it('existing union routes to stewards + Weingarten', () => {
    const r = route({ ...base, union: 'union' });
    expect(r.href).toBe('/run/stewards');
    expect(r.also.map((a) => a.href)).toContain('/rights/section-7');
  });

  it('existing drive routes to committee', () => {
    expect(route({ ...base, union: 'drive' }).href).toBe('/organize/committee');
  });

  it('no conversations yet -> first conversation', () => {
    expect(route({ ...base, talked: 'no' }).href).toBe('/organize/first-conversation');
  });

  it('talked to a few -> committee + mapping', () => {
    const r = route({ ...base, talked: 'few' });
    expect(r.href).toBe('/organize/committee');
    expect(r.also.map((a) => a.href)).toContain('/organize/map-your-workplace');
  });

  it('committee exists -> matcher', () => {
    expect(route({ ...base, talked: 'committee' }).href).toBe('/unions/matcher');
  });

  it('EWOC payload is plain text, capped at 3000 chars, bilingual', () => {
    const answers = { ...base, state: 'TX', job: 'cook at restaurant', headcount: '25', situation: 'x'.repeat(4000) };
    const en = ewocPayload(answers, 'en');
    const es = ewocPayload(answers, 'es');
    expect(en.length).toBeLessThanOrEqual(3000);
    expect(en).toContain('cook at restaurant');
    expect(en).toContain('TX');
    expect(es).toContain('Trabajo y empleador');
    expect(en.startsWith('\n')).toBe(false);
  });
});
