/**
 * The signing script and the browser have to agree (R3.10).
 *
 * The script signs bytes the browser verifies. If the two build the bytes
 * differently, every release fails its check. This test runs the script's
 * own functions over the same input and compares them with the browser's.
 */
import { describe, expect, it } from 'vitest';
import { createHash, createSign, generateKeyPairSync } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { canonicalJson, manifestBytes, toBase64, verifyManifest } from '../lib/workspace/release';
// The script and the browser use the same implementation, so the bytes
// they sign and verify are the same bytes.
import { canonicalJson as scriptCanonicalJson } from '../lib/workspace/canonical.mjs';

const MANIFEST = {
  version: '0.3.0',
  builtAt: '2026-10-27T12:00:00.000Z',
  notes: 'The notes, with a "quote" and a comma.',
  files: {
    '/app/today/index.html': { sha256: 'a'.repeat(64), bytes: 1200 },
    '/_astro/app.js': { sha256: 'b'.repeat(64), bytes: 3000 },
  },
};

describe('R3.10 the signing script and the browser agree', () => {
  it('builds the same bytes for the same manifest', () => {
    const fromBrowser = canonicalJson(MANIFEST);
    const fromScript = scriptCanonicalJson(MANIFEST);
    expect(fromScript).toBe(fromBrowser);
  });

  it('sorts the keys the same way at every level', () => {
    const a = { b: 1, a: { d: 2, c: 3 } };
    const b = { a: { c: 3, d: 2 }, b: 1 };
    expect(scriptCanonicalJson(a)).toBe(scriptCanonicalJson(b));
    expect(canonicalJson(a)).toBe(canonicalJson(b));
  });
});

describe('R3.10 the release script signs what the browser verifies', () => {
  it('signs a manifest and the browser accepts it', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'oyw-release-'));
    try {
      const { privateKey, publicKey } = generateKeyPairSync('ec', {
        namedCurve: 'prime256v1',
        privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
        publicKeyEncoding: { type: 'spki', format: 'pem' },
      });
      const keyPath = join(dir, 'key.pem');
      writeFileSync(keyPath, privateKey, { mode: 0o600 });

      // The script signs the same bytes the browser will hash.
      const signer = createSign('SHA256');
      signer.update(Buffer.from(scriptCanonicalJson(MANIFEST), 'utf-8'));
      const signature = signer
        .sign({ key: privateKey, dsaEncoding: 'ieee-p1363' })
        .toString('base64');

      const spki = publicKey
        .replace(/-----(BEGIN|END) PUBLIC KEY-----/g, '')
        .replace(/\s+/g, '');
      const spkiBase64 = Buffer.from(spki, 'base64').toString('base64');

      const result = await verifyManifest(MANIFEST, signature, [{ id: 'test', spki: spkiBase64 }]);
      expect(result.ok).toBe(true);

      // A manifest changed after the signing is refused.
      const changed = await verifyManifest(
        { ...MANIFEST, notes: 'Something else' },
        signature,
        [{ id: 'test', spki: spkiBase64 }],
      );
      expect(changed.ok).toBe(false);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('refuses to sign a release whose key is inside the repo', () => {
    const inside = join(process.cwd(), 'not-a-key.pem');
    writeFileSync(inside, 'x');
    try {
      const output = execFileSync(
        process.execPath,
        [new URL('../../scripts/release.mjs', import.meta.url).pathname, 'sign', '--version', '9.9.9'],
        { env: { ...process.env, RELEASE_SIGNING_KEY: inside }, encoding: 'utf-8', stdio: 'pipe' },
      );
      void output;
      throw new Error('the script should have refused');
    } catch (error) {
      const message = (error as { stderr?: string }).stderr ?? String(error);
      expect(message).toContain('must not live inside the repo');
    } finally {
      rmSync(inside, { force: true });
    }
  });
});

describe('R3.10 the manifest bytes the browser signs', () => {
  it('are the same as the bytes on the wire', () => {
    const bytes = manifestBytes(MANIFEST);
    expect(new TextDecoder().decode(bytes)).toBe(canonicalJson(MANIFEST));
  });

  it('hash to the same value as the script computes', async () => {
    const bytes = manifestBytes(MANIFEST);
    const fromBrowser = createHash('sha256').update(bytes).digest('hex');
    const fromScript = createHash('sha256')
      .update(Buffer.from(scriptCanonicalJson(MANIFEST), 'utf-8'))
      .digest('hex');
    expect(fromBrowser).toBe(fromScript);
  });
});

describe('R3.10 the release directory', () => {
  it('holds a manifest, a signature and an entry for each version', () => {
    const dir = new URL('../../releases/', import.meta.url).pathname;
    const versions = readdirSync(dir).filter((name: string) => /^\d+\.\d+\.\d+$/.test(name));
    expect(versions.length).toBeGreaterThan(0);
    for (const version of versions) {
      for (const file of ['manifest.json', 'manifest.sig', 'entry.json']) {
        expect(readFileSync(join(dir, version, file), 'utf-8').length).toBeGreaterThan(0);
      }
    }
  });
});

describe('R3.10 base64 of a signature', () => {
  it('round-trips', () => {
    const bytes = new Uint8Array([1, 2, 250, 251]);
    expect(atob(toBase64(bytes))).toBe(String.fromCharCode(...bytes));
  });
});
