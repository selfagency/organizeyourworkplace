import { describe, expect, it } from 'vitest';

import { coverage, type CoverageAnswers } from './coverage';

const base: CoverageAnswers = {
  employer: 'company',
  role: 'worker',
  industry: 'general',
  religiousRole: false,
  tinyEmployer: false,
};

describe('T2 coverage', () => {
  it('government is out of scope', () => {
    expect(coverage({ ...base, employer: 'government' }).outcome).toBe('not-government');
  });

  it('airline/rail -> RLA, whatever the role', () => {
    expect(coverage({ ...base, employer: 'airline-rail' }).outcome).toBe('rla');
    expect(coverage({ ...base, employer: 'airline-rail', role: 'supervisor' }).outcome).toBe('rla');
  });

  it('supervisor is not covered even at a normal company', () => {
    expect(coverage({ ...base, role: 'supervisor' }).outcome).toBe('not-supervisor');
  });

  it('contractor flags possible misclassification for companies and nonprofits', () => {
    expect(coverage({ ...base, role: 'contractor' }).misclassification).toBe(true);
    expect(coverage({ ...base, role: 'contractor', employer: 'nonprofit' }).misclassification).toBe(true);
  });

  it('agricultural and domestic workers are excluded', () => {
    expect(coverage({ ...base, industry: 'agricultural' }).outcome).toBe('not-agricultural');
    expect(coverage({ ...base, industry: 'domestic' }).outcome).toBe('not-domestic');
  });

  it('church lay staff covered, religious role exempt', () => {
    expect(coverage({ ...base, employer: 'church', religiousRole: false }).outcome).toBe('nlra');
    expect(coverage({ ...base, employer: 'church', religiousRole: true }).outcome).toBe('exempt-religious');
  });

  it('tiny employer -> likely exempt (thresholds TODO verify)', () => {
    expect(coverage({ ...base, tinyEmployer: true }).outcome).toBe('exempt-small');
  });

  it('default case is NLRA-covered', () => {
    expect(coverage(base).outcome).toBe('nlra');
    expect(coverage({ ...base, employer: 'nonprofit' }).outcome).toBe('nlra');
  });
});
