/**
 * Copies the signed releases into the built site.
 *
 * The releases live in the repo because the transparency log points at
 * their exact bytes. The build copies them next to the site, so the app
 * can fetch the manifest, the signature and the log.
 *
 *   node scripts/publish-releases.mjs
 */
import { cpSync, existsSync, mkdirSync } from 'node:fs';
import { join, resolve } from 'node:path';

const RELEASES = resolve(process.cwd(), 'releases');
const DIST = resolve(process.env.BUILD_OUT_DIR ?? resolve(process.cwd(), 'dist'));
const TARGET = join(DIST, 'releases');

if (!existsSync(RELEASES)) {
  console.log('there is no releases/ directory: nothing to publish');
  process.exit(0);
}
if (!existsSync(DIST)) {
  console.error('there is no dist/. Build first.');
  process.exit(1);
}

mkdirSync(TARGET, { recursive: true });
cpSync(RELEASES, TARGET, { recursive: true });
console.log(`the releases are in the site: ${TARGET}`);
