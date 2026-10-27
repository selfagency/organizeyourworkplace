/**
 * The release pipeline for the Committee Workspace (R3.10).
 *
 *   node scripts/release.mjs sign --version 0.1.0 --notes "What changed"
 *   node scripts/release.mjs append-log
 *   node scripts/release.mjs verify
 *   node scripts/release.mjs reproducible
 *
 * `sign` reads the built app in dist/, writes a manifest of every file the
 * app needs with its hash, signs the manifest, and leaves the result in
 * dist/releases/<version>/. The signature is what the phone checks before
 * it installs anything.
 *
 * The private key never lives in the repo. It is read from
 * RELEASE_SIGNING_KEY, a path to a PEM file outside the tree.
 */
import { createHash, createSign } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';

import { canonicalJson, entryBody } from '../src/lib/workspace/canonical.mjs';

const DIST = resolve(process.cwd(), 'dist');
/**
 * The signed releases live in the repo. A release is a specific build, so
 * its manifest is pinned there: the transparency log points at these exact
 * bytes, and they have to stay the same.
 */
const RELEASES = resolve(process.cwd(), 'releases');
const LOG_FILE = resolve(process.cwd(), 'transparency/log.jsonl');
const LOG_COPY = join(RELEASES, 'transparency.jsonl');

/** The paths the app is made of. Everything else on the site is content. */
const APP_ROOTS = ['app', 'es/app'];

/** The same canonical JSON the browser uses, so the signatures match. */

function sha256Hex(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

/**
 * The bytes of a log entry that are signed and hashed: the same without
 * the signature, so a signature never covers itself.
 */

/** Every file under a directory, as paths from the site root. */
function walk(dir, base = dir, out = []) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, base, out);
    else out.push(full);
  }
  return out;
}

/**
 * The assets an HTML page pulls in. A page in the app loads chunks that
 * live in /_astro/, and those chunks are part of what the phone has to
 * verify.
 */
function assetsOf(html) {
  const found = new Set();
  const pattern = /(?:src|href)="(\/_astro\/[^"]+)"/g;
  let match;
  while ((match = pattern.exec(html)) !== null) found.add(match[1]);
  return found;
}

/**
 * The files a release covers: the app's pages, plus every asset those
 * pages load, plus the service worker.
 */
export function collectAppFiles(dist = DIST) {
  const files = new Map();
  const assets = new Set();

  for (const root of APP_ROOTS) {
    const dir = join(dist, root);
    if (!existsSync(dir)) continue;
    for (const file of walk(dir)) {
      const rel = `/${relative(dist, file).split(/[\\/]/).join('/')}`;
      files.set(rel, file);
      if (rel.endsWith('.html')) {
        for (const asset of assetsOf(readFileSync(file, 'utf-8'))) assets.add(asset);
      }
    }
  }

  for (const asset of assets) {
    const file = join(dist, asset.replace(/^\//, ''));
    if (existsSync(file)) files.set(asset, file);
  }

  // The service worker is code too, so the manifest covers it.
  const worker = join(dist, 'app-sw.js');
  if (existsSync(worker)) files.set('/app-sw.js', worker);

  return files;
}

/** The manifest for what is in dist/ right now. */
export function buildManifest(version, notes, dist = DIST) {
  const files = {};
  for (const [path, file] of [...collectAppFiles(dist)].sort()) {
    const bytes = readFileSync(file);
    files[path] = { sha256: sha256Hex(bytes), bytes: bytes.length };
  }
  return {
    version,
    builtAt: new Date().toISOString(),
    notes,
    files,
  };
}

/** The private key, from outside the repo. */
function signingKey() {
  const path = process.env.RELEASE_SIGNING_KEY;
  if (!path) {
    throw new Error(
      'RELEASE_SIGNING_KEY is not set. It must point at a PEM file outside the repo.',
    );
  }
  const resolved = resolve(path);
  if (resolved.startsWith(resolve(process.cwd()) + '/')) {
    throw new Error('the signing key must not live inside the repo');
  }
  return readFileSync(resolved);
}

function signManifest(manifest, privatePem) {
  const signer = createSign('SHA256');
  signer.update(Buffer.from(canonicalJson(manifest), 'utf-8'));
  // ieee-p1363 gives the raw r||s form the browser's crypto expects.
  return signer.sign({ key: privatePem, dsaEncoding: 'ieee-p1363' }).toString('base64');
}

function readLog() {
  if (!existsSync(LOG_FILE)) return [];
  return readFileSync(LOG_FILE, 'utf-8')
    .split('\n')
    .filter((line) => line.trim().length > 0)
    .map((line) => JSON.parse(line));
}

function writeLog(entries) {
  mkdirSync(dirname(LOG_FILE), { recursive: true });
  writeFileSync(LOG_FILE, `${entries.map((entry) => JSON.stringify(entry)).join('\n')}\n`);
}

function arg(name, fallback = null) {
  const index = process.argv.indexOf(`--${name}`);
  if (index === -1) return fallback;
  return process.argv[index + 1] ?? fallback;
}

function cmdSign() {
  const version = arg('version');
  const notes = arg('notes', '');
  if (!version) throw new Error('usage: release.mjs sign --version X.Y.Z --notes "..."');
  if (!existsSync(DIST)) throw new Error('there is no dist/. Build first.');

  // A version is signed once. The log points at these exact bytes, so a
  // second signing has to produce the same manifest.
  const entries = readLog();
  if (entries.some((entry) => entry.version === version)) {
    throw new Error(`${version} is already in the log. Use a new version number.`);
  }

  const manifest = buildManifest(version, notes);
  const privatePem = signingKey();
  const signature = signManifest(manifest, privatePem);

  const dir = join(RELEASES, version);
  mkdirSync(dir, { recursive: true });
  // The manifest is written once and the hash in the log is over exactly
  // these bytes, so the phone can check the file it got without parsing
  // it first.
  const manifestFile = `${canonicalJson(manifest)}\n`;
  const existing = join(dir, 'manifest.json');
  if (existsSync(existing) && readFileSync(existing, 'utf-8') !== manifestFile) {
    throw new Error(`${version} was already signed with a different build. Use a new version number.`);
  }
  writeFileSync(existing, manifestFile);
  writeFileSync(join(dir, 'manifest.sig'), `${signature}\n`);

  // The entry the log needs, with the chain hash filled in.
  const prevHash =
    entries.length === 0
      ? '0'.repeat(64)
      : sha256Hex(Buffer.from(entryBody(entries[entries.length - 1]), 'utf-8'));
  const entry = {
    seq: entries.length + 1,
    version,
    manifestSha256: sha256Hex(Buffer.from(manifestFile, 'utf-8')),
    signedAt: new Date().toISOString(),
    prevHash,
  };
  const signer = createSign('SHA256');
  signer.update(Buffer.from(canonicalJson(entry), 'utf-8'));
  entry.sig = signer.sign({ key: privatePem, dsaEncoding: 'ieee-p1363' }).toString('base64');
  writeFileSync(join(dir, 'entry.json'), `${canonicalJson(entry)}\n`);

  console.log(`signed ${version}: ${Object.keys(manifest.files).length} files`);
  console.log(`manifest hash ${entry.manifestSha256}`);
  console.log('run: node scripts/release.mjs append-log');
}

function cmdAppendLog() {
  const version = arg('version') ?? newestSignedVersion();
  const dir = join(RELEASES, version);
  const entryFile = join(dir, 'entry.json');
  if (!existsSync(entryFile)) throw new Error('no entry.json. Sign a release first.');
  const entry = JSON.parse(readFileSync(entryFile, 'utf-8'));
  const entries = readLog();
  if (entries.some((e) => e.version === entry.version)) {
    console.log(`${entry.version} is already in the log`);
    return;
  }
  entries.push(entry);
  writeLog(entries);
  // The log is served with the app, so a member can see it.
  writeFileSync(LOG_COPY, readFileSync(LOG_FILE));
  console.log(`the log now has ${entries.length} entries`);
}
/** The version of the newest signed release, the one with an entry.json. */
function newestSignedVersion() {
  if (!existsSync(RELEASES)) throw new Error('there is no releases/. Sign a release first.');
  const versions = readdirSync(RELEASES)
    .filter((name) => /^\d+\.\d+\.\d+$/.test(name))
    .filter((name) => existsSync(join(RELEASES, name, 'entry.json')))
    .sort();
  if (versions.length === 0) throw new Error('there is no signed release yet.');
  return versions[versions.length - 1];
}

function cmdVerify() {
  const entries = readLog();
  if (entries.length === 0) throw new Error('the log is empty');

  let prev = '0'.repeat(64);
  for (const entry of entries) {
    if (entry.prevHash !== prev) throw new Error(`entry ${entry.seq} does not chain to the one before it`);
    const hash = sha256Hex(Buffer.from(entryBody(entry), 'utf-8'));
    const dir = join(RELEASES, entry.version);
    const manifestFile = join(dir, 'manifest.json');
    if (!existsSync(manifestFile)) {
      throw new Error(`entry ${entry.seq} points at a release that is not in the repo`);
    }
    const actual = sha256Hex(readFileSync(manifestFile));
    if (actual !== entry.manifestSha256) {
      throw new Error(`entry ${entry.seq} points at a manifest that has changed`);
    }
    prev = hash;
  }
  console.log(`the log is intact: ${entries.length} entries`);
}function cmdReproducible() {
  // Build twice into two directories and compare every file. The build has
  // to be the same every time, or a rebuild cannot be checked against a
  // release.
  //
  // The content is fetched once, before the two builds, so the only thing
  // that could make them different is the build itself.
  spawnSync(process.execPath, ['scripts/cms-fetch.mjs'], { stdio: 'inherit' });
  const dirs = [join(process.cwd(), '.tmp/repro-a'), join(process.cwd(), '.tmp/repro-b')];
  for (const dir of dirs) {
    const result = spawnSync(process.execPath, ['node_modules/astro/bin/astro.mjs', 'build'], {
      stdio: 'inherit',
      env: { ...process.env, BUILD_OUT_DIR: dir },
    });
    if (result.status !== 0) throw new Error('a build failed');    // The releases are part of the site, so they are part of the compare.
    spawnSync(process.execPath, ['scripts/publish-releases.mjs'], {
      stdio: 'inherit',
      env: { ...process.env, BUILD_OUT_DIR: dir },
    });
  }
  const a = new Map();
  const b = new Map();
  for (const [map, dir] of [
    [a, dirs[0]],
    [b, dirs[1]],
  ]) {
    for (const file of walk(dir)) {
      map.set(relative(dir, file), sha256Hex(readFileSync(file)));
    }
  }
  const differences = [];
  for (const [path, hash] of a) {
    if (!b.has(path)) differences.push(`only in the first build: ${path}`);
    else if (b.get(path) !== hash) differences.push(`different: ${path}`);
  }
  for (const path of b.keys()) {
    if (!a.has(path)) differences.push(`only in the second build: ${path}`);
  }
  if (differences.length > 0) {
    console.error('the build is not reproducible:');
    for (const line of differences.slice(0, 20)) console.error(`  ${line}`);
    process.exit(1);
  }
  console.log(`the build is reproducible: ${a.size} files, the same both times`);
}

const commands = { sign: cmdSign, 'append-log': cmdAppendLog, verify: cmdVerify, reproducible: cmdReproducible };
const command = process.argv[2];
if (!commands[command]) {
  console.error(`usage: release.mjs <${Object.keys(commands).join('|')}>`);
  process.exit(1);
}
try {
  commands[command]();
} catch (error) {
  console.error(error.message);
  process.exit(1);
}
