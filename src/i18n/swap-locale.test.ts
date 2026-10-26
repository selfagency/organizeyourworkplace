import { describe, expect, it } from 'vitest';
import { swapLocale } from './swap-locale';

describe('swapLocale', () => {
  it('maps root to /es/', () => {
    expect(swapLocale('/', 'es')).toBe('/es/');
  });

  it('maps /es/ back to root', () => {
    expect(swapLocale('/es/', 'en')).toBe('/');
  });

  it('keeps the same English page when switching to Spanish', () => {
    expect(swapLocale('/rights/section-7/', 'es')).toBe('/es/rights/section-7/');
  });

  it('keeps the same Spanish page when switching to English', () => {
    expect(swapLocale('/es/rights/section-7/', 'en')).toBe('/rights/section-7/');
  });

  it('handles paths without a trailing slash', () => {
    expect(swapLocale('/rights/section-7', 'es')).toBe('/es/rights/section-7');
    expect(swapLocale('/es/rights/section-7', 'en')).toBe('/rights/section-7');
  });

  it('does not strip /es from the middle of a path', () => {
    expect(swapLocale('/rights/espanol-resources/', 'es')).toBe(
      '/es/rights/espanol-resources/',
    );
  });

  it('handles bare /es without trailing slash', () => {
    expect(swapLocale('/es', 'en')).toBe('/');
    expect(swapLocale('/es', 'es')).toBe('/es/');
  });
});