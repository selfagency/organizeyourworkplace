/**
 * T3 Union matcher logic (plans/03-private-tools.md §T3).
 * Pure filter over the verified directory. Neutral ordering: verified
 * intake first, then by name — never by opinion.
 */

export interface MatcherUnion {
  id: string;
  name: string;
  who_they_organize: string;
  recent_example: string | null;
  organizing_intake: string | null;
  status: 'verified' | 'unverified' | 'TODO(verify)';
  sectors: string[];
}

export interface MatcherInput {
  sector: string;
  /** Two-letter state; "" = anywhere. Kept for the result copy only. */
  state?: string;
}

export function match(unions: MatcherUnion[], input: MatcherInput): MatcherUnion[] {
  const inSector = unions.filter((u) => u.sectors.includes(input.sector));
  // Verified rows first (they can render a live link), then alphabetical.
  return inSector.sort((a, b) => {
    const av = a.status === 'verified' && a.organizing_intake ? 0 : 1;
    const bv = b.status === 'verified' && b.organizing_intake ? 0 : 1;
    return av - bv || a.name.localeCompare(b.name);
  });
}
