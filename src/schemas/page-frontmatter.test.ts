import { describe, expect, it } from 'vitest';
import { pageFrontmatterSchema } from './page-frontmatter';

const validBase = {
  title: "You're protected even without a union",
  section: 'rights',
  lang: 'en',
};

describe('pageFrontmatterSchema', () => {
  it('accepts a minimal non-legal page', () => {
    const result = pageFrontmatterSchema.safeParse(validBase);
    expect(result.success).toBe(true);
  });

  it('defaults review to pending', () => {
    const result = pageFrontmatterSchema.parse(validBase);
    expect(result.review).toBe('pending');
  });

  it('defaults stage to null and legal to false', () => {
    const result = pageFrontmatterSchema.parse(validBase);
    expect(result.stage).toBeNull();
    expect(result.legal).toBe(false);
  });

  it('accepts a legal page with status_as_of', () => {
    const result = pageFrontmatterSchema.safeParse({
      ...validBase,
      legal: true,
      status_as_of: '2026-10-26',
    });
    expect(result.success).toBe(true);
  });

  it('rejects a legal page without status_as_of', () => {
    const result = pageFrontmatterSchema.safeParse({ ...validBase, legal: true });
    expect(result.success).toBe(false);
  });

  it('rejects an unknown section', () => {
    const result = pageFrontmatterSchema.safeParse({ ...validBase, section: 'blog' });
    expect(result.success).toBe(false);
  });

  it('rejects an unknown lang', () => {
    const result = pageFrontmatterSchema.safeParse({ ...validBase, lang: 'fr' });
    expect(result.success).toBe(false);
  });

  it('rejects stage out of range', () => {
    const result = pageFrontmatterSchema.safeParse({ ...validBase, stage: 9 });
    expect(result.success).toBe(false);
  });

  it('accepts next_steps entries', () => {
    const result = pageFrontmatterSchema.safeParse({
      ...validBase,
      next_steps: [{ text: 'Check if you are covered', href: '/rights/am-i-covered' }],
    });
    expect(result.success).toBe(true);
  });

  it('rejects next_steps missing href', () => {
    const result = pageFrontmatterSchema.safeParse({
      ...validBase,
      next_steps: [{ text: 'Check if you are covered' }],
    });
    expect(result.success).toBe(false);
  });

  it('coerces a YAML date into a Date', () => {
    const result = pageFrontmatterSchema.parse({
      ...validBase,
      legal: true,
      status_as_of: '2026-10-26',
    });
    expect(result.status_as_of).toBeInstanceOf(Date);
    expect(result.status_as_of?.toISOString().slice(0, 10)).toBe('2026-10-26');
  });
});