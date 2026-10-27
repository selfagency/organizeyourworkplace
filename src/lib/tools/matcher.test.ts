import { describe, expect, it } from 'vitest';

import { match, type MatcherUnion } from './matcher';

const u = (over: Partial<MatcherUnion>): MatcherUnion => ({
  id: 'x',
  name: 'X',
  who_they_organize: '',
  recent_example: null,
  organizing_intake: null,
  status: 'unverified',
  sectors: ['food'],
  ...over,
});

describe('T3 matcher', () => {
  const unions: MatcherUnion[] = [
    u({ id: 'b', name: 'Beta Union', organizing_intake: 'https://beta.example', status: 'verified' }),
    u({ id: 'a', name: 'Alpha Union', status: 'verified', organizing_intake: null }),
    u({ id: 'c', name: 'Charlie Union', status: 'verified' }),
    u({ id: 'd', name: 'Other Union', sectors: ['healthcare'] }),
  ];

  it('filters by sector', () => {
    const r = match(unions, { sector: 'food' });
    expect(r.map((x) => x.id)).toEqual(['b', 'a', 'c']);
  });

  it('verified intake first, then alphabetical — no opinion ordering', () => {
    const r = match(unions, { sector: 'food' });
    expect(r[0].id).toBe('b');
    expect(r.slice(1).map((x) => x.name)).toEqual(['Alpha Union', 'Charlie Union']);
  });

  it('unknown sector yields empty result (UI shows the EWOC fallback)', () => {
    expect(match(unions, { sector: 'nothing' })).toEqual([]);
  });

  it('unverified rows never sort ahead of verified intake', () => {
    const mixed = [
      u({ id: 'z', name: 'AAA Unverified', status: 'unverified' }),
      u({ id: 'y', name: 'ZZZ Verified', status: 'verified', organizing_intake: 'https://y.example' }),
    ];
    expect(match(mixed, { sector: 'food' }).map((x) => x.id)).toEqual(['y', 'z']);
  });
});
