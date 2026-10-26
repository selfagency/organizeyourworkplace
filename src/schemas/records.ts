import { z } from 'astro/zod';

/**
 * Record schemas mirroring plans/02-data-model.md.
 * Pure Zod so the build-time loader and tests share one definition.
 * Dates arrive as ISO strings from JSON exports; z.coerce.date() normalizes.
 */

const slug = z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, 'must be a lowercase slug');
const isoDate = z.coerce.date();
const url = z.url();

export const unionStatus = z.enum(['verified', 'partially_verified', 'to_verify']);

export const unionSchema = z.object({
  id: slug,
  name: z.string(),
  abbreviation: z.string(),
  affiliation: z.string(),
  sectors: z.array(slug),
  who_they_organize: z.string(),
  // Only verified intake links may render (AGENTS.md hard rule 5);
  // rendering checks status, the schema just holds the data.
  organizing_intake: url.nullable(),
  // Full intake text when the cell holds several unions' links or notes.
  intake_note: z.string().optional(),
  local_finder: url.nullable(),
  local_finder_note: z.string().optional(),
  recent_wins: z.array(slug),
  // Carryover from unions.csv until campaign records exist (agent assumption,
  // logged in 06-open-decisions.md).
  recent_example: z.string().optional(),
  membership: z.record(z.string(), z.unknown()).optional(),
  finances: z.record(z.string(), z.unknown()).optional(),
  olms_file_number: z.string().optional(),
  status: unionStatus,
  last_checked: isoDate,
  sources: z.array(z.string()),
});

export const localSchema = z.object({
  id: slug,
  number: z.string(),
  parent_union: slug,
  name: z.string(),
  city: z.string(),
  state: z.string(),
  address: z.string().nullable(),
  membership: z.number().int().nonnegative(),
  sectors: z.array(slug),
  organizing_active: z.boolean(),
  olms_file_number: z.string(),
  fiscal_year: z.string(),
  last_checked: isoDate,
});

export const sectorSchema = z.object({
  id: slug,
  name: z.string(),
  plain_jobs: z.string(),
  unions: z.array(slug),
  union_density: z.number().nullable(),
  notes: z.string(),
});

export const legalRuleStatus = z.enum([
  'in_force',
  'targeted',
  'split_by_circuit',
  'overturned',
]);

export const legalRuleSchema = z.object({
  id: slug,
  rule: z.string(),
  plain_summary: z.string(),
  status: legalRuleStatus,
  where_it_applies: z.string(),
  status_as_of: isoDate,
  citation: z.string(),
  what_to_tell_workers: z.string(),
  history: z.array(
    z.object({
      date: isoDate,
      change: z.string(),
      source: z.string(),
    }),
  ),
});

export const stateLawSchema = z.object({
  state: z.string(),
  topic: z.string(),
  status: z.string(),
  effective: isoDate.nullable(),
  citation: z.string(),
  status_as_of: isoDate,
});

export const campaignSchema = z.object({
  employer: z.string(),
  union: slug,
  sector: slug,
  outcome: z.string(),
  year: z.number().int(),
  link: url.nullable(),
  source: z.string(),
});

export const sourceSchema = z.object({
  id: z.string(),
  title: z.string(),
  publisher: z.string(),
  tier: z.number().int().min(1).max(4),
  date: isoDate,
  url,
});

export const helpResourceType = z.enum([
  'lawyer',
  'worker_center',
  'nlrb_office',
  'legal_clinic',
]);

export const helpResourceSchema = z.object({
  type: helpResourceType,
  name: z.string(),
  area_served: z.string(),
  languages: z.array(z.string()),
  contact: z.string(),
  source: z.string(),
  last_checked: isoDate,
});