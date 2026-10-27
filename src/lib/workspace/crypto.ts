/**
 * R3 crypto primitives (05-security §Building blocks): WebCrypto only.
 * Generic JSON envelopes for any workspace structure; AES-GCM at rest;
 * PBKDF2-SHA256 (600k) for the passphrase key. Same primitives as the
 * evidence log — this module is the shared source.
 */

const enc = new TextEncoder();
const dec = new TextDecoder();

export function randomSalt(bytes = 16): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(bytes));
}

/** PBKDF2-SHA256, 600k iterations -> AES-GCM 256 key. */
export async function deriveKey(
  passphrase: string,
  salt: Uint8Array = randomSalt(),
): Promise<CryptoKey> {
  const keyMaterial = await crypto.subtle.importKey('raw', enc.encode(passphrase), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: salt as BufferSource, iterations: 600_000, hash: 'SHA-256' },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}

/** iv-prefixed AES-GCM ciphertext over arbitrary bytes. */
export async function sealBytes(bytes: Uint8Array, key: CryptoKey): Promise<ArrayBuffer> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const cipher = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, bytes as BufferSource);
  const out = new Uint8Array(iv.length + cipher.byteLength);
  out.set(iv);
  out.set(new Uint8Array(cipher), iv.length);
  return out.buffer;
}

export async function openBytes(blob: ArrayBuffer, key: CryptoKey): Promise<Uint8Array> {
  const bytes = new Uint8Array(blob);
  try {
    return new Uint8Array(
      await crypto.subtle.decrypt({ name: 'AES-GCM', iv: bytes.slice(0, 12) }, key, bytes.slice(12)),
    );
  } catch {
    throw new Error('decrypt failed (wrong passphrase or tampered blob)');
  }
}

export const sealJson = (value: unknown, key: CryptoKey) => sealBytes(enc.encode(JSON.stringify(value)), key);
export const openJson = async <T>(blob: ArrayBuffer, key: CryptoKey): Promise<T> =>
  JSON.parse(dec.decode(await openBytes(blob, key))) as T;
