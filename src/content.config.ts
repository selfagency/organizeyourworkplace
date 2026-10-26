import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';

import { pageFrontmatterSchema } from './schemas/page-frontmatter';

/**
 * Content pages live in src/content/pages/{lang}/... and map to routes:
 *   en/rights/section-7.md -> /rights/section-7
 *   es/rights/section-7.md -> /es/rights/section-7
 */
const pages = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/pages' }),
  schema: pageFrontmatterSchema,
});

export const collections = { pages };