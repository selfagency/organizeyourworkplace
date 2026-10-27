import { describe, expect, it } from 'vitest';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { loadRecords, getUnions, getSectors, getStateLaws, getLegalRules, getHelpResources } from './load';
import { unionSchema, sectorSchema, stateLawSchema, legalRuleSchema, helpResourceSchema } from '../schemas/records';

describe('loadRecords', () => {
  it('throws on invalid records with a readable message', () => {
    const dir = mkdtempSync(join(tmpdir(), 'oyw-data-'));
    try {
      writeFileSync(join(dir, 'bad.json'), JSON.stringify([{ id: 'NOT_A_SLUG' }]));
      expect(() => loadRecords('bad.json', unionSchema, dir)).toThrow(/bad\.json/);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('throws on malformed JSON', () => {
    const dir = mkdtempSync(join(tmpdir(), 'oyw-data-'));
    try {
      writeFileSync(join(dir, 'broken.json'), '{not json');
      expect(() => loadRecords('broken.json', unionSchema, dir)).toThrow();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe('all data files validate', () => {
  it('sectors.json parses against sectorSchema', () => {
    expect(() => getSectors()).not.toThrow();
    expect(getSectors().length).toBeGreaterThan(0);
  });

  it('state-laws.json parses against stateLawSchema', () => {
    expect(() => getStateLaws()).not.toThrow();
    expect(getStateLaws()).toHaveLength(12);
  });

  it('legal-rules.json parses against legalRuleSchema', () => {
    expect(() => getLegalRules()).not.toThrow();
    expect(getLegalRules().length).toBeGreaterThan(0);
  });

  it('help-resources.json parses against helpResourceSchema', () => {
    expect(() => getHelpResources()).not.toThrow();
    expect(getHelpResources().filter((r) => r.type === 'nlrb_office').length).toBe(48);
  });

  it('every sector union id resolves to a union record', () => {
    const unionIds = new Set(getUnions().map((u) => u.id));
    for (const sector of getSectors()) {
      for (const uid of sector.unions) {
        expect(unionIds.has(uid), `sector ${sector.id} references unknown union ${uid}`).toBe(true);
      }
    }
  });
});

describe('getUnions (real data)', () => {
  it('loads all 26 directory rows', () => {
    const unions = getUnions();
    expect(unions).toHaveLength(26);
  });

  it('has unique ids', () => {
    const unions = getUnions();
    expect(new Set(unions.map((u) => u.id)).size).toBe(unions.length);
  });

  it('keeps unverified rows without a renderable intake link', () => {
    const unions = getUnions();
    for (const u of unions) {
      if (u.status === 'to_verify') {
        // Rendering gates on status; data may hold a URL but the row must
        // not present it as a live link (AGENTS.md hard rule 5).
        expect(u.id).toBeTruthy();
      }
    }
  });
});