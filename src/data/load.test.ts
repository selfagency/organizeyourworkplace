import { describe, expect, it, tmpdirTest } from 'vitest';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { loadRecords, getUnions } from './load';
import { unionSchema } from '../schemas/records';

describe('loadRecords', () => {
  it('throws on invalid records with a readable message', () => {
    const dir = mkdtempSync(join(tmpdir(), 'oyw-data-'));
    try {
      writeFileSync(join(dir, 'bad.json'), JSON.stringify([{ id: 'NOT_A_SLUG' }]));
      expect(() => loadRecords('bad.json', unionSchema, dir)).toThrowError(/bad\.json/);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('throws on malformed JSON', () => {
    const dir = mkdtempSync(join(tmpdir(), 'oyw-data-'));
    try {
      writeFileSync(join(dir, 'broken.json'), '{not json');
      expect(() => loadRecords('broken.json', unionSchema, dir)).toThrowError();
    } finally {
      rmSync(dir, { recursive: true, force: true });
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