/**
 * Release verification for the Committee Workspace (R3.10).
 *
 * A release is a set of files (the built app) plus a manifest that says
 * what each file is and what it hashes to. The manifest is signed by the
 * maintainer's key. The app checks the signature and the hashes before it
 * installs anything, so a tampered build never reaches a phone.
 *
 * The trust anchor is the public key in `config.ts`, compiled into the app.
 * The transparency log is the append-only record of every release: it
 * chains each entry to the one before it, so a release that was taken back
 * is visible.
 *
 * Nothing here talks to a server. The caller fetches; this decides.
 */

/** One file in a release. */
export interface ReleaseFile {
  /** The path from the site root, for example `/app/today/index.html`. */
  path: string;
  /** Lowercase hex, SHA-256 of the bytes. */
  sha256: string;
  /** How many bytes. */
  bytes: number;
}

/** What a release says about itself. */
export interface ReleaseManifest {
  /** `major.minor.patch`. The app only moves forward. */
  version: string;
  /** When it was built, ISO 8601. */
  builtAt: string;
  /** What changed, in plain words, for the member to read. */
  notes: string;
  /** The files, keyed by path. */
  files: Record<string, { sha256: string; bytes: number }>;
}

/** One line of the transparency log. */
export interface TransparencyEntry {
  /** Position in the log, from 1. */
  seq: number;
  /** The version this entry announces. */
  version: string;
  /** The hash of the manifest this entry points at. */
  manifestSha256: string;
  /** When the entry was made, ISO 8601. */
  signedAt: string;
  /** The hash of the previous entry. The first entry chains from zeros. */
  prevHash: string;
  /** The signature over everything above, base64. */
  sig: string;
}

const GENESIS_HASH = '0'.repeat(64);

import { canonicalJson, entryBody } from './canonical.mjs';

export { canonicalJson };

export function toBase64(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

export function fromBase64(text: string): Uint8Array {
  const binary = atob(text);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

export function toHex(bytes: Uint8Array): string {
  return [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', bytes as BufferSource);
  return toHex(new Uint8Array(digest));
}

/** The manifest bytes that are signed. */
export function manifestBytes(manifest: ReleaseManifest): Uint8Array {
  return new TextEncoder().encode(canonicalJson(manifest));
}

/**
 * The bytes of a transparency entry that are signed and hashed. `sig` is
 * left out, so a signature never covers itself.
 */
export function entryBytes(entry: TransparencyEntry | Omit<TransparencyEntry, 'sig'>): Uint8Array {
  return new TextEncoder().encode(entryBody(entry));
}

/**
 * The hash that chains one log entry to the one before it. The next
 * entry carries this hash in its `prevHash`.
 */
export async function entryHash(entry: TransparencyEntry | Omit<TransparencyEntry, 'sig'>): Promise<string> {
  return sha256Hex(entryBytes(entry));
}

function b64ToBytes(b64: string): Uint8Array {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

/**
 * Checks a signature against a public key. The key is ECDSA P-256 with a
 * SHA-256 hash, in the raw signature form the browser's crypto expects.
 */
export async function verifySignature(
  data: Uint8Array,
  signature: Uint8Array,
  publicKeySpkiBase64: string,
): Promise<boolean> {
  try {
    const key = await crypto.subtle.importKey(
      'spki',
      b64ToBytes(publicKeySpkiBase64) as BufferSource,
      { name: 'ECDSA', namedCurve: 'P-256' },
      false,
      ['verify'],
    );
    return await crypto.subtle.verify(
      { name: 'ECDSA', hash: 'SHA-256' },
      key,
      signature as BufferSource,
      data as BufferSource,
    );
  } catch {
    // A key that will not import is a key we cannot trust.
    return false;
  }
}

/** Reads a manifest and checks it is shaped the way it should be. */
export function parseManifest(text: string): ReleaseManifest | null {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return null;
  }
  if (typeof raw !== 'object' || raw === null) return null;
  const m = raw as Partial<ReleaseManifest>;
  if (typeof m.version !== 'string' || !/^\d+\.\d+\.\d+$/.test(m.version)) return null;
  if (typeof m.builtAt !== 'string' || m.builtAt.length === 0) return null;
  if (typeof m.notes !== 'string') return null;
  if (typeof m.files !== 'object' || m.files === null) return null;
  for (const [path, entry] of Object.entries(m.files)) {
    if (!path.startsWith('/')) return null;
    if (typeof entry?.sha256 !== 'string' || !/^[0-9a-f]{64}$/.test(entry.sha256)) return null;
    if (typeof entry.bytes !== 'number' || !Number.isInteger(entry.bytes) || entry.bytes < 0) return null;
  }
  return m as ReleaseManifest;
}

/**
 * Checks a manifest's signature with one of the trusted keys.
 *
 * A key is trusted when it is in the list and it has not passed its
 * `notAfter` date. The date is checked against the manifest's own build
 * date, not today's, so a key that expired later still covers the release
 * it signed.
 */
export async function verifyManifest(
  manifest: ReleaseManifest,
  signatureBase64: string,
  trustedKeys: { id: string; spki: string; notAfter?: string }[],
): Promise<{ ok: true; keyId: string } | { ok: false; reason: string }> {
  const bytes = manifestBytes(manifest);
  const hash = await sha256Hex(bytes);
  const signedAt = manifest.builtAt.slice(0, 10);
  for (const key of trustedKeys) {
    if (key.notAfter && signedAt > key.notAfter) continue;
    if (await verifySignature(bytes, b64ToBytes(signatureBase64), key.spki)) {
      return { ok: true, keyId: key.id };
    }
  }
  return { ok: false, reason: `no trusted key signed this release (${hash.slice(0, 12)})` };
}

/** Compares two versions. -1, 0 or 1. */
export function compareVersions(a: string, b: string): number {
  const pa = a.split('.').map((n) => Number.parseInt(n, 10) || 0);
  const pb = b.split('.').map((n) => Number.parseInt(n, 10) || 0);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const diff = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (diff !== 0) return diff < 0 ? -1 : 1;
  }
  return 0;
}

/**
 * Checks the transparency log: every entry is signed by a trusted key, and
 * every entry chains to the one before it. A log that has been rewritten
 * fails here.
 */
export async function verifyTransparencyLog(
  entries: TransparencyEntry[],
  trustedKeys: { id: string; spki: string; notAfter?: string }[],
): Promise<{ ok: true } | { ok: false; reason: string; seq: number }> {
  let prev = GENESIS_HASH;
  for (const entry of entries) {
    // The entry points at the one before it.
    if (entry.prevHash !== prev) {
      return { ok: false, reason: 'the log was changed', seq: entry.seq };
    }
    const signedAt = entry.signedAt.slice(0, 10);
    let signed = false;
    for (const key of trustedKeys) {
      if (key.notAfter && signedAt > key.notAfter) continue;
      if (await verifySignature(entryBytes(entry), b64ToBytes(entry.sig), key.spki)) {
        signed = true;
        break;
      }
    }
    if (!signed) return { ok: false, reason: 'an entry was not signed', seq: entry.seq };
    prev = await entryHash(entry);
  }
  return { ok: true };
}

/** The entry that announces a version, if the log has one. */
export function findEntry(entries: TransparencyEntry[], version: string): TransparencyEntry | null {
  return entries.find((entry) => entry.version === version) ?? null;
}

/**
 * Checks that the bytes of a file are the bytes the manifest says.
 */
export async function fileMatches(manifest: ReleaseManifest, path: string, bytes: Uint8Array): Promise<boolean> {
  const entry = manifest.files[path];
  if (!entry) return false;
  if (entry.bytes !== bytes.length) return false;
  return (await sha256Hex(bytes)) === entry.sha256;
}

/** The paths a release changes, given what is already on the device. */
export function changedPaths(
  manifest: ReleaseManifest,
  have: Record<string, string>,
): string[] {
  return Object.entries(manifest.files)
    .filter(([path, entry]) => have[path] !== entry.sha256)
    .map(([path]) => path)
    .sort();
}
