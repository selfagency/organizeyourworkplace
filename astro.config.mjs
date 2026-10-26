// @ts-check
import { defineConfig } from 'astro/config';

// Static output is the default. No prefetch config: prefetch is opt-in and
// stays off because we never add <ClientRouter />. (07-stack-and-hosting.md A1–A3)
export default defineConfig({
  site: 'https://organizeyourworkplace.com',
  // English unprefixed at /, Spanish at /es/... (07-stack-and-hosting.md A1)
  i18n: {
    locales: ['en', 'es'],
    defaultLocale: 'en',
    routing: { prefixDefaultLocale: false },
  },
  // v7 default 'jsx' can swallow whitespace between inline elements in
  // text-heavy pages; `true` keeps the v5 behavior.
  compressHTML: true,
});