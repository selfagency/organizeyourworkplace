import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';

import { pageFrontmatterSchema } from './schemas/page-frontmatter';

/**
 * Content pages come from the PocketBase cms export (data/cms-export/pages).
 * The cms is the system of record; scripts/cms-export.mjs writes this
 * directory and the build reads only it (plans/02-data-model.md).
 *   en/rights/section-7.md -> /rights/section-7
 *   es/rights/section-7.md -> /es/rights/section-7
 */
const pages = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './data/cms-export/pages' }),
  schema: pageFrontmatterSchema,
});

export const collections = { pages };