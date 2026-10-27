// The nightly export (plans/07-stack-and-hosting.md P4).
//
// It refreshes the reviewable mirror in data/*.json from the PocketBase
// cms, so a change is diffable in a pull request and the content survives
// a PocketBase failure. The pages themselves are not exported into the
// repo: the cms holds them, and the build reads them from there.
//
//   node scripts/cms-export.mjs
//
// The build does not read this mirror when the cms is reachable. It reads
// .cache/cms, which scripts/cms-fetch.mjs fills.
import { spawnSync } from 'node:child_process';

const result = spawnSync(process.execPath, ['scripts/cms-fetch.mjs', '--mirror', 'data'], {
  stdio: 'inherit',
});

if (result.status !== 0) {
  console.error('the export failed');
  process.exit(result.status ?? 1);
}

console.log('the mirror in data/ is up to date');
