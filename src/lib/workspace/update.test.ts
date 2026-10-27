/**
 * The update check, end to end (R3.10).
 *
 * The stub stands in for the server: it serves what a real server would,
 * and then it serves something tampered, to see whether the app refuses.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';

import { canonicalJson, entryBytes, entryHash, type ReleaseManifest, type TransparencyEntry } from './release';
import { checkForUpdate, latestSource, type ReleaseSource } from './update';

async function makeKeyPair() {
  const pair = await crypto.subtle.generateKey(
    { name: 'ECDSA', namedCurve: 'P-256' },
    true,
    ['sign', 'verify'],
  );
  const spki = await crypto.subtle.exportKey('spki', pair.publicKey);
  return {
    spki: btoa(String.fromCharCode(...new Uint8Array(spki))),
    async sign(data: Uint8Array): Promise<string> {
      const signature = await crypto.subtle.sign(
        { name: 'ECDSA', hash: 'SHA-256' },
        pair.privateKey,
        data as BufferSource,
      );
      return btoa(String.fromCharCode(...new Uint8Array(signature)));
    },
  };
}

const MANIFEST: ReleaseManifest = {
  version: '0.2.0',
  builtAt: '2026-10-27T12:00:00.000Z',
  notes: 'Fixes the wall chart numbers.',
  files: { '/app/today/index.html': { sha256: 'a'.repeat(64), bytes: 1200 } },
};

async function signedRelease(key: { sign: (d: Uint8Array) => Promise<string> }) {
  const manifestText = canonicalJson(MANIFEST);
  const manifestBytes = new TextEncoder().encode(manifestText);
  const signature = await key.sign(manifestBytes);
  const digest = await crypto.subtle.digest('SHA-256', manifestBytes);
  const manifestSha256 = [...new Uint8Array(digest)]
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
  const entryBody = {
    seq: 1,
    version: MANIFEST.version,
    manifestSha256,
    signedAt: '2026-10-27T12:00:00.000Z',
    prevHash: '0'.repeat(64),
  };
  const entry: TransparencyEntry = { ...entryBody, sig: await key.sign(entryBytes(entryBody)) };
  return { manifestText, signature, log: `${JSON.stringify(entry)}\n` };
}

/** Serves the release over a stubbed fetch. */
function serve(files: Record<string, string>) {
  vi.stubGlobal('fetch', async (url: string) => {
    const path = String(url);
    const body = files[path];
    if (body === undefined) return { ok: false, status: 404, text: async () => 'not found' };
    return { ok: true, status: 200, text: async () => body };
  });
}

const SOURCE: ReleaseSource = latestSource('https://app.example.org');

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('R3.10 update check', () => {
  it('says there is a new version when the release checks out', async () => {
    const key = await makeKeyPair();
    const release = await signedRelease(key);
    serve({
      'https://app.example.org/releases/0.2.0/manifest.json': release.manifestText,
      'https://app.example.org/releases/0.2.0/manifest.sig': release.signature,
      'https://app.example.org/releases/transparency.jsonl': release.log,
    });

    const result = await checkForUpdate(SOURCE, '0.1.0', [{ id: 'test', spki: key.spki }]);
    expect(result.state).toBe('available');
    expect(result.latest).toBe('0.2.0');
    expect(result.notes).toBe('Fixes the wall chart numbers.');
  });

  it('refuses a release whose manifest was changed after it was signed', async () => {
    const key = await makeKeyPair();
    const release = await signedRelease(key);
    const tampered = canonicalJson({ ...MANIFEST, notes: 'Something else' });
    serve({
      'https://app.example.org/releases/0.2.0/manifest.json': tampered,
      'https://app.example.org/releases/0.2.0/manifest.sig': release.signature,
      'https://app.example.org/releases/transparency.jsonl': release.log,
    });

    const result = await checkForUpdate(SOURCE, '0.1.0', [{ id: 'test', spki: key.spki }]);
    expect(result.state).toBe('broken');
  });

  it('refuses a release that is not in the log', async () => {
    const key = await makeKeyPair();
    const release = await signedRelease(key);
    serve({
      'https://app.example.org/releases/0.2.0/manifest.json': release.manifestText,
      'https://app.example.org/releases/0.2.0/manifest.sig': release.signature,
      'https://app.example.org/releases/transparency.jsonl': '',
    });

    const result = await checkForUpdate(SOURCE, '0.1.0', [{ id: 'test', spki: key.spki }]);
    expect(result.state).toBe('broken');
  });

  it('refuses a release signed by a key it does not trust', async () => {
    const key = await makeKeyPair();
    const other = await makeKeyPair();
    const release = await signedRelease(other);
    serve({
      'https://app.example.org/releases/0.2.0/manifest.json': release.manifestText,
      'https://app.example.org/releases/0.2.0/manifest.sig': release.signature,
      'https://app.example.org/releases/transparency.jsonl': release.log,
    });

    const result = await checkForUpdate(SOURCE, '0.1.0', [{ id: 'test', spki: key.spki }]);
    expect(result.state).toBe('broken');
  });

  it('says it is up to date when the version matches', async () => {
    const key = await makeKeyPair();
    const release = await signedRelease(key);
    serve({
      'https://app.example.org/releases/0.2.0/manifest.json': release.manifestText,
      'https://app.example.org/releases/0.2.0/manifest.sig': release.signature,
      'https://app.example.org/releases/transparency.jsonl': release.log,
    });

    const result = await checkForUpdate(SOURCE, '0.2.0', [{ id: 'test', spki: key.spki }]);
    expect(result.state).toBe('up-to-date');
  });

  it('does not offer an older release as an update', async () => {
    const key = await makeKeyPair();
    const release = await signedRelease(key);
    serve({
      'https://app.example.org/releases/0.2.0/manifest.json': release.manifestText,
      'https://app.example.org/releases/0.2.0/manifest.sig': release.signature,
      'https://app.example.org/releases/transparency.jsonl': release.log,
    });

    const result = await checkForUpdate(SOURCE, '0.3.0', [{ id: 'test', spki: key.spki }]);
    expect(result.state).toBe('up-to-date');
  });

  it('says what went wrong when the server cannot be reached', async () => {
    vi.stubGlobal('fetch', async () => {
      throw new Error('the network is down');
    });
    const result = await checkForUpdate(SOURCE, '0.1.0', []);
    expect(result.state).toBe('broken');
    expect(result.reason).toContain('network');
  });
});
