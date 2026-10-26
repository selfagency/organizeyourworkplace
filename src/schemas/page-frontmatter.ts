import { z } from 'astro/zod';

/**
 * Front matter for every content page (01-content.md §Page template).
 * Pure Zod so both the content collection and tests use the same schema.
 */

export const SECTIONS = [
  'start',
  'rights',
  'organize',
  'unions',
  'vote',
  'contract',
  'run',
  'case',
  'toolkit',
  'help',
  'about',
] as const;

export const pageFrontmatterSchema = z
  .object({
    title: z.string(),
    section: z.enum(SECTIONS),
    stage: z.number().int().min(1).max(8).nullable().default(null),
    legal: z.boolean().default(false),
    status_as_of: z.coerce.date().optional(),
    review: z.enum(['pending', 'approved']).default('pending'),
    sources: z.array(z.string()).default([]),
    related_tools: z.array(z.string()).default([]),
    next_steps: z
      .array(z.object({ text: z.string(), href: z.string() }))
      .default([]),
    lang: z.enum(['en', 'es']),
    translation_of: z.string().nullable().default(null),
  })
  // Rule: every legal page carries an as-of date (AGENTS.md hard rule 6).
  .refine((data) => !data.legal || data.status_as_of !== undefined, {
    error: 'legal: true requires status_as_of',
  });

export type PageFrontmatter = z.infer<typeof pageFrontmatterSchema>;