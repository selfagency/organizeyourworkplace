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
  // The build goes to a different directory when one is named, so the
  // release script can build twice and compare (05-security.md
  // §Code delivery: a build has to be the same every time).
  outDir: process.env.BUILD_OUT_DIR ?? './dist',
  // Keep every script an external file: CSP is `script-src 'self'`, which
  // forbids inline scripts, and SRI (05-security.md §Web hardening) needs files.
  vite: {
    build: {
      assetsInlineLimit: 0,
    },
  },
});