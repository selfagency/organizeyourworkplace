/**
 * The release checks (R3.10).
 *
 * The point of every test here is that a tampered release is refused.
 */
import { describe, expect, it } from 'vitest';

import {
  canonicalJson,
  changedPaths,
  compareVersions,
  entryBytes,
  entryHash,
  fileMatches,
  findEntry,
  fromBase64,
  manifestBytes,
  parseManifest,
  sha256Hex,
  toBase64,
  verifyManifest,
  verifySignature,
  verifyTransparencyLog,
  type ReleaseManifest,
  type TransparencyEntry,
} from './release';

/** A key pair made for the test, so the test does not need the real one. */
async function makeKeyPair() {
  const pair = await crypto.subtle.generateKey(
    { name: 'ECDSA', namedCurve: 'P-256' },
    true,
    ['sign', 'verify'],
  );
  const spki = await crypto.subtle.exportKey('spki', pair.publicKey);
  return {
    spki: toBase64(new Uint8Array(spki)),
    async sign(data: Uint8Array): Promise<string> {
      const signature = await crypto.subtle.sign(
        { name: 'ECDSA', hash: 'SHA-256' },
        pair.privateKey,
        data as BufferSource,
      );
      return toBase64(new Uint8Array(signature));
    },
  };
}

const MANIFEST: ReleaseManifest = {
  version: '0.2.0',
  builtAt: '2026-10-27T12:00:00.000Z',
  notes: 'The first release with the update check.',
  files: {
    '/app/today/index.html': { sha256: 'a'.repeat(64), bytes: 1200 },
    '/_astro/app.js': { sha256: 'b'.repeat(64), bytes: 3000 },
  },
};

describe('R3.10 release manifest', () => {
  it('reads a manifest that is shaped right', () => {
    const manifest = parseManifest(canonicalJson(MANIFEST));
    expect(manifest?.version).toBe('0.2.0');
    expect(Object.keys(manifest?.files ?? {})).toHaveLength(2);
  });

  it('refuses a manifest with the wrong shape', () => {
    expect(parseManifest('not json')).toBeNull();
    expect(parseManifest('{"version":"one"}')).toBeNull();
    expect(parseManifest(canonicalJson({ ...MANIFEST, version: '0.2' }))).toBeNull();
    expect(parseManifest(canonicalJson({ ...MANIFEST, files: { 'app/x': { sha256: 'zz', bytes: 1 } } }))).toBeNull();
    expect(parseManifest(canonicalJson({ ...MANIFEST, files: { 'app/x': { sha256: 'a'.repeat(64), bytes: -1 } } }))).toBeNull();
  });

  it('gives the same bytes for the same manifest, whatever the key order', async () => {
    const a = manifestBytes({ version: '0.2.0', files: {}, notes: '', builtAt: 'x' });
    const b = manifestBytes({ builtAt: 'x', notes: '', files: {}, version: '0.2.0' });
    expect(toBase64(a)).toBe(toBase64(b));
  });

  it('compares versions by number, not by spelling', () => {
    expect(compareVersions('0.2.0', '0.1.9')).toBe(1);
    expect(compareVersions('0.1.9', '0.2.0')).toBe(-1);
    expect(compareVersions('1.0.0', '1.0.0')).toBe(0);
    expect(compareVersions('0.10.0', '0.9.0')).toBe(1);
  });
});

describe('R3.10 release signature', () => {
  it('accepts a manifest signed by a trusted key', async () => {
    const key = await makeKeyPair();
    const signature = await key.sign(manifestBytes(MANIFEST));
    const result = await verifyManifest(MANIFEST, signature, [{ id: 'test', spki: key.spki }]);
    expect(result.ok).toBe(true);
  });

  it('refuses a manifest whose signature does not match', async () => {
    const key = await makeKeyPair();
    const other = await makeKeyPair();
    const signature = await other.sign(manifestBytes(MANIFEST));
    const result = await verifyManifest(MANIFEST, signature, [{ id: 'test', spki: key.spki }]);
    expect(result.ok).toBe(false);
  });

  it('refuses a manifest that was changed after it was signed', async () => {
    const key = await makeKeyPair();
    const signature = await key.sign(manifestBytes(MANIFEST));
    const tampered = { ...MANIFEST, notes: 'something else entirely' };
    const result = await verifyManifest(tampered, signature, [{ id: 'test', spki: key.spki }]);
    expect(result.ok).toBe(false);
  });

  it('refuses a key that is past its end date', async () => {
    const key = await makeKeyPair();
    const signature = await key.sign(manifestBytes(MANIFEST));
    const result = await verifyManifest(MANIFEST, signature, [
      { id: 'old', spki: key.spki, notAfter: '2026-01-01' },
    ]);
    expect(result.ok).toBe(false);
  });

  it('refuses a key that is not there at all', async () => {
    const result = await verifyManifest(MANIFEST, 'AAAA', []);
    expect(result.ok).toBe(false);
  });
});

describe('R3.10 transparency log', () => {
  async function signEntry(
    key: { sign: (data: Uint8Array) => Promise<string> },
    entry: Omit<TransparencyEntry, 'sig'>,
  ): Promise<TransparencyEntry> {
    return { ...entry, sig: await key.sign(entryBytes(entry)) };
  }

  it('accepts a log that is signed and chained', async () => {
    const key = await makeKeyPair();
    const first = await signEntry(key, {
      seq: 1,
      version: '0.1.0',
      manifestSha256: 'c'.repeat(64),
      signedAt: '2026-10-01T00:00:00.000Z',
      prevHash: '0'.repeat(64),
    });
    const second = await signEntry(key, {
      seq: 2,
      version: '0.2.0',
      manifestSha256: 'd'.repeat(64),
      signedAt: '2026-10-20T00:00:00.000Z',
      prevHash: await entryHash(first),
    });
    const result = await verifyTransparencyLog([first, second], [{ id: 'test', spki: key.spki }]);
    expect(result.ok).toBe(true);
  });

  it('refuses a log with an entry taken out of the middle', async () => {
    const key = await makeKeyPair();
    const first = await signEntry(key, {
      seq: 1,
      version: '0.1.0',
      manifestSha256: 'c'.repeat(64),
      signedAt: '2026-10-01T00:00:00.000Z',
      prevHash: '0'.repeat(64),
    });
    const second = await signEntry(key, {
      seq: 2,
      version: '0.2.0',
      manifestSha256: 'd'.repeat(64),
      signedAt: '2026-10-20T00:00:00.000Z',
      prevHash: await entryHash(first),
    });
    // A log of one entry is fine on its own.
    const alone = await verifyTransparencyLog([first], [{ id: 'test', spki: key.spki }]);
    expect(alone.ok).toBe(true);
    // Two entries, chained: fine.
    const chained = await verifyTransparencyLog([first, second], [{ id: 'test', spki: key.spki }]);
    expect(chained.ok).toBe(true);
    // The second entry on its own does not chain from the start.
    const alone2 = await verifyTransparencyLog([second], [{ id: 'test', spki: key.spki }]);
    expect(alone2.ok).toBe(false);
  });

  it('refuses an entry that was changed after it was signed', async () => {
    const key = await makeKeyPair();
    const entry = await signEntry(key, {
      seq: 1,
      version: '0.1.0',
      manifestSha256: 'c'.repeat(64),
      signedAt: '2026-10-01T00:00:00.000Z',
      prevHash: '0'.repeat(64),
    });
    const changed = { ...entry, version: '9.9.9' };
    const result = await verifyTransparencyLog([changed], [{ id: 'test', spki: key.spki }]);
    expect(result.ok).toBe(false);
  });

  it('finds the entry for a version', () => {
    const entries = [
      { seq: 1, version: '0.1.0', manifestSha256: 'c'.repeat(64), signedAt: 'x', prevHash: '0'.repeat(64), sig: 's' },
    ] as TransparencyEntry[];
    expect(findEntry(entries, '0.1.0')?.seq).toBe(1);
    expect(findEntry(entries, '0.2.0')).toBeNull();
  });
});

describe('R3.10 file checks', () => {
  it('accepts a file whose bytes match the manifest', async () => {
    const bytes = new TextEncoder().encode('hello');
    const hash = await sha256Hex(bytes);
    const manifest: ReleaseManifest = {
      version: '0.2.0',
      builtAt: '2026-10-27T12:00:00.000Z',
      notes: '',
      files: { '/app/x.js': { sha256: hash, bytes: bytes.length } },
    };
    expect(await fileMatches(manifest, '/app/x.js', bytes)).toBe(true);
  });

  it('refuses a file that was changed on the way', async () => {
    const bytes = new TextEncoder().encode('hello');
    const manifest: ReleaseManifest = {
      version: '0.2.0',
      builtAt: '2026-10-27T12:00:00.000Z',
      notes: '',
      files: { '/app/x.js': { sha256: await sha256Hex(bytes), bytes: bytes.length } },
    };
    const other = new TextEncoder().encode('hellp');
    expect(await fileMatches(manifest, '/app/x.js', other)).toBe(false);
  });

  it('refuses a file the manifest says nothing about', async () => {
    const manifest: ReleaseManifest = {
      version: '0.2.0',
      builtAt: '2026-10-27T12:00:00.000Z',
      notes: '',
      files: {},
    };
    expect(await fileMatches(manifest, '/app/x.js', new Uint8Array([1]))).toBe(false);
  });

  it('lists only the files that are new or different', () => {
    const manifest: ReleaseManifest = {
      version: '0.2.0',
      builtAt: '2026-10-27T12:00:00.000Z',
      notes: '',
      files: {
        '/a.js': { sha256: '1'.repeat(64), bytes: 1 },
        '/b.js': { sha256: '2'.repeat(64), bytes: 2 },
        '/c.js': { sha256: '3'.repeat(64), bytes: 3 },
      },
    };
    const have = { '/a.js': '1'.repeat(64), '/b.js': '9'.repeat(64) };
    expect(changedPaths(manifest, have)).toEqual(['/b.js', '/c.js']);
  });
});

describe('R3.10 base64', () => {
  it('round-trips bytes', () => {
    const bytes = new Uint8Array([0, 1, 127, 128, 255]);
    expect(fromBase64(toBase64(bytes))).toEqual(bytes);
  });
});
