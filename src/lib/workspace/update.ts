/**
 * The update flow for the Committee Workspace (R3.10).
 *
 * The phone checks a release before it installs it:
 *
 *   1. The manifest says what the release is and what each file hashes to.
 *   2. The signature proves the manifest came from us.
 *   3. The transparency log says the release is in the record, so a
 *      release that was quietly taken back is visible.
 *   4. Every file is hashed again after it arrives, so a file that changed
 *      on the way is refused.
 *
 * A release the phone cannot verify is never installed. The old version
 * keeps working.
 */

import { APP_VERSION } from '../../app-version';
import { RELEASE_TRUSTED_KEYS, type TrustedReleaseKey } from '../../release-keys';
import {
  changedPaths,
  compareVersions,
  fileMatches,
  findEntry,
  parseManifest,
  sha256Hex,
  toBase64,
  verifyManifest,
  verifyTransparencyLog,
  type ReleaseManifest,
  type TransparencyEntry,
} from './release';

/** The shape of a trusted key. The same one the app is built with. */
export type TrustedKey = TrustedReleaseKey;

export interface UpdateCheck {
  /** What the app is doing right now. */
  state: 'idle' | 'checking' | 'up-to-date' | 'available' | 'broken';
  /** The version the phone is running. */
  current: string;
  /** The version on the server, when there is one. */
  latest?: string;
  /** What changed, in the words the maintainer wrote. */
  notes?: string;
  /** The files that have to be fetched to install the release. */
  files?: string[];
  /** Why the check failed, when it did. */
  reason?: string;
}

/** Where the release files live. Same origin as the app. */
export interface ReleaseSource {
  /** The origin the release files are on. */
  origin?: string;
  /** The manifest for a version. */
  manifestUrl: string;
  /** The signature over the manifest. */
  signatureUrl: string;
  /** The transparency log. It is the index: it says which versions exist. */
  logUrl: string;
}

const RELEASE_ROOT = '/releases';

/** The source for a version, on the origin the app is served from. */
export function sourceFor(version: string, origin = ''): ReleaseSource {
  return {
    origin,
    manifestUrl: `${origin}${RELEASE_ROOT}/${version}/manifest.json`,
    signatureUrl: `${origin}${RELEASE_ROOT}/${version}/manifest.sig`,
    logUrl: `${origin}${RELEASE_ROOT}/transparency.jsonl`,
  };
}

/**
 * The source for the newest release. The version comes from the log, so
 * the app does not have to know it.
 */
export function latestSource(origin = ''): ReleaseSource {
  return sourceFor('', origin);
}

/** The version the phone is running. It is compiled into the app. */
export function installedVersion(): string {
  return APP_VERSION;
}

/**
 * The key the phone trusts. It is compiled into the app, so a tampered
 * build cannot swap it out.
 */
function trustedKeys(): TrustedKey[] {
  return RELEASE_TRUSTED_KEYS;
}

async function fetchText(url: string): Promise<string> {
  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok) throw new Error(`${url} answered ${res.status}`);
  return res.text();
}

async function fetchBytes(url: string): Promise<Uint8Array> {
  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok) throw new Error(`${url} answered ${res.status}`);
  return new Uint8Array(await res.arrayBuffer());
}

function parseLog(text: string): TransparencyEntry[] {
  return text
    .split('\n')
    .filter((line) => line.trim().length > 0)
    .map((line) => {
      const entry = JSON.parse(line) as TransparencyEntry;
      return entry;
    });
}

/**
 * Reads the log and checks that it is intact.
 */
async function loadLog(
  source: ReleaseSource,
  keys: TrustedKey[],
): Promise<{ entries: TransparencyEntry[] } | { error: string }> {
  const logText = await fetchText(source.logUrl);
  const entries = parseLog(logText);
  if (entries.length === 0) return { error: 'the release log is empty' };
  const logCheck = await verifyTransparencyLog(entries, keys);
  if (!logCheck.ok) return { error: logCheck.reason };
  return { entries };
}

/**
 * Checks one version: the manifest is fetched, its hash has to match the
 * log, and the signature has to be from a key the app trusts.
 */
async function verifyVersion(
  version: string,
  origin: string,
  entries: TransparencyEntry[],
  keys: TrustedKey[],
): Promise<{ manifest: ReleaseManifest } | { error: string }> {
  const entry = findEntry(entries, version);
  if (!entry) return { error: 'this release is not in the log' };

  const versionSource = sourceFor(version, origin);
  const manifestText = await fetchText(versionSource.manifestUrl);
  const signatureText = (await fetchText(versionSource.signatureUrl)).trim();

  const manifest = parseManifest(manifestText);
  if (!manifest) return { error: 'the release manifest is not readable' };
  if (manifest.version !== version) return { error: 'the manifest and the log disagree' };

  // The hash is over exactly the bytes that arrived, so a file that was
  // changed on the way does not match the log.
  const manifestHash = await sha256Hex(new TextEncoder().encode(manifestText));
  if (entry.manifestSha256 !== manifestHash) return { error: 'the release does not match the log' };

  const signature = await verifyManifest(manifest, signatureText, keys);
  if (!signature.ok) return { error: signature.reason };

  return { manifest };
}

/**
 * Checks the newest release on the server and says what it found.
 *
 * Nothing is installed here. The member sees the version and the notes and
 * decides.
 */
export async function checkForUpdate(
  source: ReleaseSource,
  current = installedVersion(),
  keys: TrustedKey[] = trustedKeys(),
): Promise<UpdateCheck> {
  try {
    const log = await loadLog(source, keys);
    if ('error' in log) return { state: 'broken', current, reason: log.error };
    const entries = log.entries;

    // The log is the index: the newest entry is the newest release.
    const newest = entries[entries.length - 1];
    const checked = await verifyVersion(newest.version, source.origin ?? '', entries, keys);
    if ('error' in checked) return { state: 'broken', current, reason: checked.error };
    const manifest = checked.manifest;

    if (manifest.version === current) {
      return { state: 'up-to-date', current, latest: manifest.version };
    }
    if (compareVersions(manifest.version, current) < 0) {
      // A release older than what is installed. It is in the log and
      // signed, so it is real, but it is not an upgrade.
      return { state: 'up-to-date', current, latest: current };
    }

    return {
      state: 'available',
      current,
      latest: manifest.version,
      notes: manifest.notes,
      files: Object.keys(manifest.files).sort(),
    };
  } catch (error) {
    return {
      state: 'broken',
      current,
      reason: error instanceof Error ? error.message : 'the check failed',
    };
  }
}

/**
 * Checks one version and returns its manifest, when it checks out.
 *
 * This is what the app uses to make its known-good copy: the version it
 * is running has to be signed and in the log, or the copy is not made.
 */
export async function verifyRelease(
  version: string,
  origin = '',
  keys: TrustedKey[] = trustedKeys(),
): Promise<{ manifest: ReleaseManifest } | { error: string }> {
  try {
    const source = sourceFor(version, origin);
    const log = await loadLog(source, keys);
    if ('error' in log) return { error: log.error };
    return verifyVersion(version, origin, log.entries, keys);
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'the check failed' };
  }
}

/** How many files are fetched at once. A phone on 3G stays polite. */
const FETCH_CONCURRENCY = 6;

/**
 * Fetches the files of a release and checks each one against the manifest.
 * A file that does not match is not returned.
 *
 * The files are fetched a few at a time, not one after another: the update
 * runs on a phone on a slow network, and forty-six round trips in a row is
 * the difference between a tap and a dead screen. Each file is verified on
 * its own, so the order never matters.
 */
export async function fetchVerifiedFiles(
  manifest: ReleaseManifest,
  paths: string[],
  origin = '',
): Promise<{ files: Map<string, Uint8Array>; rejected: string[] }> {
  const files = new Map<string, Uint8Array>();
  const rejected: string[] = [];
  let next = 0;
  const workers = Array.from({ length: Math.min(FETCH_CONCURRENCY, paths.length) }, async () => {
    for (;;) {
      const index = next++;
      if (index >= paths.length) return;
      const path = paths[index]!;
      const bytes = await fetchBytes(`${origin}${path}`);
      if (await fileMatches(manifest, path, bytes)) files.set(path, bytes);
      else rejected.push(path);
    }
  });
  await Promise.allSettled(workers);
  rejected.sort();
  return { files, rejected };
}

/**
 * The files a release changes, given the hashes the device already has.
 */
export function filesToFetch(manifest: ReleaseManifest, have: Record<string, string>): string[] {
  return changedPaths(manifest, have);
}

/** The hash of a file, for the record of what the device has. */
export async function hashOf(bytes: Uint8Array): Promise<string> {
  return sha256Hex(bytes);
}

/** The bytes of a file, as base64, for storage. */
export function encodeFile(bytes: Uint8Array): string {
  return toBase64(bytes);
}
