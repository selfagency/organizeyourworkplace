import { describe, expect, it } from 'vitest';
import { isExternalUrl } from './links';

describe('isExternalUrl', () => {
  const site = 'organizeyourworkplace.com';

  it('flags a different host', () => {
    expect(isExternalUrl(new URL('https://ewoc.org/support'), site)).toBe(true);
  });

  it('flags a subdomain of another site', () => {
    expect(isExternalUrl(new URL('https://go.nationalnursesunited.org/x'), site)).toBe(true);
  });

  it('accepts our own domain', () => {
    expect(
      isExternalUrl(new URL('https://organizeyourworkplace.com/rights/'), site),
    ).toBe(false);
  });

  it('accepts www as our own domain', () => {
    expect(
      isExternalUrl(new URL('https://www.organizeyourworkplace.com/rights/'), site),
    ).toBe(false);
  });

  it('treats localhost as internal in dev', () => {
    expect(isExternalUrl(new URL('http://localhost:4321/rights/'), 'localhost:4321')).toBe(false);
  });

  it('ignores non-http protocols (mailto, tel)', () => {
    expect(isExternalUrl(new URL('mailto:organizer@example.com'), site)).toBe(false);
    expect(isExternalUrl(new URL('tel:+15551234567'), site)).toBe(false);
  });
});