/**
 * T2 Coverage checker logic (plans/03-private-tools.md §T2).
 * Sorts the worker into NLRA / RLA / likely exempt / not covered.
 * Pure function; UI adds localized labels.
 */

export type CoverageOutcome =
  | 'nlra'
  | 'rla'
  | 'exempt-religious'
  | 'exempt-small'
  | 'not-government'
  | 'not-supervisor'
  | 'not-contractor'
  | 'not-agricultural'
  | 'not-domestic';

export interface CoverageAnswers {
  employer: 'company' | 'nonprofit' | 'airline-rail' | 'church' | 'government';
  role: 'worker' | 'supervisor' | 'contractor';
  industry: 'general' | 'agricultural' | 'domestic';
  /** Church employee whose job is spreading the faith (clergy, religious ed). */
  religiousRole: boolean;
  /** Employer is tiny (roughly under ~15 people). Thresholds TODO(verify). */
  tinyEmployer: boolean;
}

export interface CoverageResult {
  outcome: CoverageOutcome;
  /** True when the answer pattern suggests possible misclassification. */
  misclassification?: boolean;
}

export function coverage(a: CoverageAnswers): CoverageResult {
  if (a.employer === 'government') return { outcome: 'not-government' };
  if (a.employer === 'airline-rail') return { outcome: 'rla' };
  if (a.role === 'supervisor') return { outcome: 'not-supervisor' };
  if (a.role === 'contractor')
    return a.employer === 'company' || a.employer === 'nonprofit'
      ? { outcome: 'not-contractor', misclassification: true }
      : { outcome: 'not-contractor' };
  if (a.industry === 'agricultural') return { outcome: 'not-agricultural' };
  if (a.industry === 'domestic') return { outcome: 'not-domestic' };
  if (a.employer === 'church')
    return a.religiousRole ? { outcome: 'exempt-religious' } : { outcome: 'nlra' };
  if (a.tinyEmployer) return { outcome: 'exempt-small' };
  return { outcome: 'nlra' };
}
