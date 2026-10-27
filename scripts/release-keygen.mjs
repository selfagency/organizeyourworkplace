/**
 * Makes a signing key for the app releases.
 *
 *   node scripts/release-keygen.mjs
 *
 * The private key is written outside the repo, because a key in the repo
 * is a key in every clone of it. The public key goes into
 * `src/config.ts`, where the phone checks it.
 */
import { generateKeyPairSync } from 'node:crypto';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

const DIR = join(homedir(), '.config', 'organizeyourworkplace');
const PRIVATE = join(DIR, 'release-key.pem');
const PUBLIC = join(DIR, 'release-key.pub.pem');

if (existsSync(PRIVATE)) {
  console.error(`${PRIVATE} is already there. Not overwriting it.`);
  process.exit(1);
}

mkdirSync(DIR, { recursive: true, mode: 0o700 });
const { privateKey, publicKey } = generateKeyPairSync('ec', {
  namedCurve: 'prime256v1',
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  publicKeyEncoding: { type: 'spki', format: 'pem' },
});
writeFileSync(PRIVATE, privateKey, { mode: 0o600 });
writeFileSync(PUBLIC, publicKey, { mode: 0o644 });

// The phone checks the key in the raw form the browser's crypto takes.
const spki = publicKey
  .replace(/-----(BEGIN|END) PUBLIC KEY-----/g, '')
  .replace(/\s+/g, '');
const spkiBase64 = Buffer.from(spki, 'base64').toString('base64');

console.log(`the private key is at ${PRIVATE} (keep it out of the repo)`);
console.log(`the public key is at ${PUBLIC}`);
console.log('');
console.log('put this in src/config.ts:');
console.log('');
console.log(`  { id: 'main', spki: '${spkiBase64}' },`);
console.log('');
console.log('and set RELEASE_SIGNING_KEY when you sign:');
console.log('');
console.log(`  export RELEASE_SIGNING_KEY=${PRIVATE}`);
