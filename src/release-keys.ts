/**
 * The keys the app trusts to sign a release.
 *
 * A public key is public. It is here so the phone can check a release
 * without asking anyone. The private key never lives in the repo.
 *
 * A key can be given an end date. After that date the app stops trusting
 * it for new releases, which is how a key is retired: the phone keeps
 * accepting the releases the key already signed, and refuses the ones it
 * signs afterwards.
 *
 * To add a key: generate it with `node scripts/release-keygen.mjs`, put
 * the public part here, and give the old key its end date. To remove a
 * key: delete it here.
 */
export interface TrustedReleaseKey {
  id: string;
  /** The public key, base64, in the raw form the browser's crypto takes. */
  spki: string;
  /** The last day this key may sign a release, ISO date. */
  notAfter?: string;
}

export const RELEASE_TRUSTED_KEYS: TrustedReleaseKey[] = [
  {
    id: 'main',
    spki:
      'MFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAEsZXmbxutkarOlur7mfuJJ3hWDkikdR5Mm6hrs7eZlu7Y7Ayx21bvu3dZmAFVvEqXK5GiaNU3JmzA3UKA1Ofojg==',
  },
];
