import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';

import { pageFrontmatterSchema } from './schemas/page-frontmatter';

/**
 * Content pages come from the PocketBase cms. The cms is the system of
 * record; scripts/cms-fetch.mjs pulls the pages into .cache/cms/pages at
 * build time and the build reads only that (plans/07-stack-and-hosting.md
 * A4). Nothing about the content lives in the repo.
 *   en/rights/section-7.md -> /rights/section-7
 *   es/rights/section-7.md -> /es/rights/section-7
 */
const pages = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './.cache/cms/pages' }),
  schema: pageFrontmatterSchema,
});

export const collections = { pages };