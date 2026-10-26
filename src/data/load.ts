import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { z, type ZodType } from 'astro/zod';

import {
  campaignSchema,
  helpResourceSchema,
  legalRuleSchema,
  localSchema,
  sectorSchema,
  sourceSchema,
  stateLawSchema,
  unionSchema,
} from '../schemas/records';

/**
 * Build-time data layer (plans/02-data-model.md, 07-stack-and-hosting.md A4/A6).
 * Records live in data/*.json — the nightly git export from the PocketBase
 * `cms` instance is the source of truth until the cms exists. The build fails
 * on any invalid record: every accessor validates and throws.
 */

const DEFAULT_DATA_DIR = resolve(process.cwd(), 'data');
const cache = new Map<string, unknown>();

export function loadRecords<T>(
  file: string,
  schema: ZodType<T>,
  dataDir: string = DEFAULT_DATA_DIR,
): T[] {
  const key = `${dataDir}/${file}`;
  if (cache.has(key)) return cache.get(key) as T[];
  let raw: unknown;
  try {
    raw = JSON.parse(readFileSync(join(dataDir, file), 'utf-8'));
  } catch (error) {
    throw new Error(`data/${file} is not readable JSON: ${(error as Error).message}`);
  }
  const parsed = z.array(schema).safeParse(raw);
  if (!parsed.success) {
    const detail = parsed.error.issues
      .map((issue) => `[${issue.path.join('.')}] ${issue.message}`)
      .join('; ');
    throw new Error(`Invalid records in data/${file}: ${detail}`);
  }
  cache.set(key, parsed.data);
  return parsed.data;
}

export const getUnions = () => loadRecords('unions.json', unionSchema);
export const getLocals = () => loadRecords('locals.json', localSchema);
export const getSectors = () => loadRecords('sectors.json', sectorSchema);
export const getLegalRules = () => loadRecords('legal-rules.json', legalRuleSchema);
export const getStateLaws = () => loadRecords('state-laws.json', stateLawSchema);
export const getCampaigns = () => loadRecords('campaigns.json', campaignSchema);
export const getSources = () => loadRecords('sources.json', sourceSchema);
export const getHelpResources = () => loadRecords('help-resources.json', helpResourceSchema);