# The app releases

Every release of the Committee Workspace is a manifest of files, signed
with the maintainer's key, and recorded in an append-only log. The app
checks all three before it installs anything.

## What is in here

| Path | What it is |
|---|---|
| `releases/<version>/manifest.json` | Every file of that release, with its hash and its size. |
| `releases/<version>/manifest.sig` | The signature over the manifest. |
| `releases/<version>/entry.json` | The line this release gets in the log. |
| `transparency/log.jsonl` | The log. One line per release, each chained to the one before it. |

The build copies `releases/` into the site, so `/releases/<version>/manifest.json`
and `/releases/transparency.jsonl` are served with the app.

## Making a release

```sh
npm run build
export RELEASE_SIGNING_KEY=~/.config/organizeyourworkplace/release-key.pem
node scripts/release.mjs sign --version 0.2.0 --notes "What changed"
node scripts/release.mjs append-log
node scripts/release.mjs verify
npm run build
```

The last build puts the signed release in the site. Commit `releases/`,
`transparency/log.jsonl` and the version in `src/app-version.ts`.

**A version is signed once.** The log points at the exact bytes of the
manifest, so signing the same version with a different build is refused.
Use a new version number.

## The private key

It never lives in the repo. `scripts/release-keygen.mjs` puts it in
`~/.config/organizeyourworkplace/`. The script refuses to sign with a key
that is inside the working tree.

To retire a key, give it an end date in `src/release-keys.ts`:

```ts
{ id: 'main', spki: '...', notAfter: '2027-01-01' }
```

The app stops trusting it for new releases after that date. The releases it
already signed stay good, because the check is against the release's own
build date.

## What the app checks

1. The log is intact: every entry is signed and chains to the one before it.
2. The manifest is signed by a key the app was built with.
3. The manifest matches the hash in the log.
4. Every file is hashed again after it arrives.
5. The service worker is checked before it is registered.

A release that fails any of these is not installed. The version on the
phone keeps working.

## The build has to be the same every time

```sh
node scripts/release.mjs reproducible
```

Builds twice into two directories and compares every file. The CI runs it
on every push. If it fails, the release cannot be trusted either: a
release that cannot be reproduced cannot be checked by anyone else.
