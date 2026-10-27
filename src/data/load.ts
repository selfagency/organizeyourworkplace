import { existsSync, readFileSync } from 'node:fs';
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
 *
 * The records live in the PocketBase `cms`. scripts/cms-fetch.mjs pulls them
 * into .cache/cms at build time, and this module reads that copy. The files
 * in data/*.json are the nightly export (P4): the reviewable mirror, the
 * handoff copy, and the fallback when there is no database to read.
 *
 * Every accessor validates and throws, so the build fails on an invalid or
 * unverified record (A6).
 */

const CACHE_DIR = resolve(process.cwd(), '.cache/cms');
const MIRROR_DIR = resolve(process.cwd(), 'data');
const cache = new Map<string, unknown>();

export function loadRecords<T>(
  file: string,
  schema: ZodType<T>,
  dataDir: string = MIRROR_DIR,
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

/**
 * The records for a collection. The copy the cms gave us wins; the
 * committed export is the fallback.
 */
function loadCollection<T>(file: string, schema: ZodType<T>): T[] {
  try {
    return loadRecords(file, schema, CACHE_DIR);
  } catch (error) {
    if (!existsSync(join(CACHE_DIR, file))) {
      return loadRecords(file, schema, MIRROR_DIR);
    }
    throw error;
  }
}

export const getUnions = () => loadCollection('unions.json', unionSchema);
export const getLocals = () => loadCollection('locals.json', localSchema);
export const getSectors = () => loadCollection('sectors.json', sectorSchema);
export const getLegalRules = () => loadCollection('legal-rules.json', legalRuleSchema);
export const getStateLaws = () => loadCollection('state-laws.json', stateLawSchema);
export const getCampaigns = () => loadCollection('campaigns.json', campaignSchema);
export const getSources = () => loadCollection('sources.json', sourceSchema);
export const getHelpResources = () => loadCollection('help-resources.json', helpResourceSchema);