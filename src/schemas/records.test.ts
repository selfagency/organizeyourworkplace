import { describe, expect, it } from 'vitest';
import {
  campaignSchema,
  helpResourceSchema,
  legalRuleSchema,
  localSchema,
  sectorSchema,
  sourceSchema,
  stateLawSchema,
  unionSchema,
} from './records';

describe('unionSchema', () => {
  const valid = {
    id: 'uaw',
    name: 'United Auto Workers',
    abbreviation: 'UAW',
    affiliation: 'AFL-CIO',
    sectors: ['autos-manufacturing'],
    who_they_organize: 'Auto and parts plants, grad workers',
    organizing_intake: 'https://uaw.org/organize/contact-uaw-organizing/',
    local_finder: null,
    recent_wins: [],
    status: 'verified',
    last_checked: '2026-10-26',
    sources: [],
  };

  it('accepts a verified union', () => {
    expect(unionSchema.safeParse(valid).success).toBe(true);
  });

  it('rejects an unknown status', () => {
    expect(unionSchema.safeParse({ ...valid, status: 'rumored' }).success).toBe(false);
  });

  it('rejects a bad id (not a slug)', () => {
    expect(unionSchema.safeParse({ ...valid, id: 'UAW!' }).success).toBe(false);
  });

  it('allows organizing_intake to be null (unverified)', () => {
    expect(unionSchema.safeParse({ ...valid, organizing_intake: null }).success).toBe(true);
  });

  it('allows the recent_example carryover field', () => {
    expect(
      unionSchema.safeParse({ ...valid, recent_example: 'NLRB bargaining order vs Amazon at JFK8' })
        .success,
    ).toBe(true);
  });

  it('allows intake_note for composite rows', () => {
    expect(
      unionSchema.safeParse({ ...valid, organizing_intake: null, intake_note: 'IATSE: https://iatse.net/join/ ...' })
        .success,
    ).toBe(true);
  });
});

describe('legalRuleSchema', () => {
  const valid = {
    id: 'cemex',
    rule: 'Cemex (2023)',
    plain_summary: 'After a card majority, the employer must recognize the union or file for an election within 2 weeks.',
    status: 'split_by_circuit',
    where_it_applies: 'all',
    status_as_of: '2026-10-26',
    citation: '372 NLRB No. 130',
    what_to_tell_workers: "Don't plan on a bargaining order.",
    history: [{ date: '2026-03-01', change: '6th Circuit struck it down (Brown-Forman)', source: 'P1-3' }],
  };

  it('accepts a rule with history', () => {
    expect(legalRuleSchema.safeParse(valid).success).toBe(true);
  });

  it('rejects an unknown status', () => {
    expect(legalRuleSchema.safeParse({ ...valid, status: 'maybe' }).success).toBe(false);
  });

  it('rejects a history entry without a source', () => {
    const bad = { ...valid, history: [{ date: '2026-03-01', change: 'x' }] };
    expect(legalRuleSchema.safeParse(bad).success).toBe(false);
  });
});

describe('sourceSchema', () => {
  it('accepts tier 1-4', () => {
    expect(
      sourceSchema.safeParse({ id: 'P1-6', title: 'UFCW', publisher: 'UFCW', tier: 3, date: '2026-01-01', url: 'https://www.ufcw.org/' }).success,
    ).toBe(true);
  });

  it('rejects tier 5', () => {
    expect(
      sourceSchema.safeParse({ id: 'X', title: 't', publisher: 'p', tier: 5, date: '2026-01-01', url: 'https://x.com/' }).success,
    ).toBe(false);
  });
});

describe('stateLawSchema', () => {
  it('accepts a captive-audience ban record', () => {
    expect(
      stateLawSchema.safeParse({
        state: 'CA',
        topic: 'captive_audience_ban',
        status: 'in_force',
        effective: '2024-01-01',
        citation: 'AB 2746',
        status_as_of: '2026-10-26',
      }).success,
    ).toBe(true);
  });
});

describe('campaignSchema', () => {
  it('accepts a campaign record', () => {
    expect(
      campaignSchema.safeParse({
        employer: 'Amazon (JFK8)',
        union: 'teamsters',
        sector: 'warehouse-delivery',
        outcome: 'bargaining_order',
        year: 2026,
        link: null,
        source: 'P1-11',
      }).success,
    ).toBe(true);
  });
});

describe('sectorSchema', () => {
  it('accepts a sector record', () => {
    expect(
      sectorSchema.safeParse({
        id: 'coffee-restaurants',
        name: 'Coffee shops and restaurants',
        plain_jobs: 'baristas, line cooks, servers',
        unions: ['workers-united', 'ufcw'],
        union_density: null,
        notes: '',
      }).success,
    ).toBe(true);
  });
});

describe('localSchema', () => {
  it('accepts a local record', () => {
    expect(
      localSchema.safeParse({
        id: 'teamsters-local-804',
        number: '804',
        parent_union: 'teamsters',
        name: 'Teamsters Local 804',
        city: 'New York',
        state: 'NY',
        address: null,
        membership: 3000,
        sectors: ['warehouse-delivery'],
        organizing_active: false,
        olms_file_number: '000-123',
        fiscal_year: '2025',
        last_checked: '2026-10-26',
      }).success,
    ).toBe(true);
  });
});

describe('helpResourceSchema', () => {
  it('accepts a lawyer record', () => {
    expect(
      helpResourceSchema.safeParse({
        type: 'lawyer',
        name: 'Example Labor Law Center',
        area_served: 'NY',
        languages: ['en', 'es'],
        contact: 'https://example.org/',
        source: 'P1-6',
        last_checked: '2026-10-26',
      }).success,
    ).toBe(true);
  });

  it('rejects an unknown type', () => {
    expect(
      helpResourceSchema.safeParse({
        type: 'chatbot',
        name: 'x',
        area_served: 'NY',
        languages: ['en'],
        contact: 'https://x.org/',
        source: 'P1-6',
        last_checked: '2026-10-26',
      }).success,
    ).toBe(false);
  });
});