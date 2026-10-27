/**
 * R3.4 key primitives (05-security §Invites, §Deniable edits).
 *
 * WebCrypto only. Device keys are ECDH P-256 pairs used to hand a room key
 * to one new device without a server ever seeing either half. The private key
 * is generated non-extractable, so it cannot be read out of the page.
 */

const enc = new TextEncoder();

export interface DeviceKeyPair {
  privateKey: CryptoKey;
  publicKey: CryptoKey;
  /** Raw uncompressed point, what travels in an invite. */
  publicRaw: Uint8Array;
}

export function randomBytes(length: number): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(length));
}

const B64URL = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';

export function toBase64Url(bytes: Uint8Array): string {
  let out = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const b0 = bytes[i] as number;
    const b1 = bytes[i + 1];
    const b2 = bytes[i + 2];
    out += B64URL[b0 >> 2];
    out += B64URL[((b0 & 3) << 4) | ((b1 ?? 0) >> 4)];
    if (b1 === undefined) break;
    out += B64URL[((b1 & 15) << 2) | ((b2 ?? 0) >> 6)];
    if (b2 === undefined) break;
    out += B64URL[b2 & 63];
  }
  return out;
}

export function fromBase64Url(value: string): Uint8Array {
  const digits: number[] = [];
  for (const char of value) {
    const digit = B64URL.indexOf(char);
    if (digit < 0) throw new Error('not base64url');
    digits.push(digit);
  }
  const bytes: number[] = [];
  for (let i = 0; i < digits.length; i += 4) {
    const d0 = digits[i] as number;
    const d1 = digits[i + 1];
    const d2 = digits[i + 2];
    const d3 = digits[i + 3];
    bytes.push((d0 << 2) | ((d1 ?? 0) >> 4));
    if (d1 === undefined) break;
    bytes.push(((d1 & 15) << 4) | ((d2 ?? 0) >> 2));
    if (d2 === undefined) break;
    bytes.push(((d2 & 3) << 6) | (d3 ?? 0));
  }
  // The last group is padded out, so keep only the bytes the bits can carry.
  return new Uint8Array(bytes.slice(0, Math.floor((digits.length * 6) / 8)));
}

export async function generateDeviceKeyPair(): Promise<DeviceKeyPair> {
  const pair = (await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, false, [
    'deriveBits',
  ])) as CryptoKeyPair;
  const publicRaw = new Uint8Array(await crypto.subtle.exportKey('raw', pair.publicKey));
  return { privateKey: pair.privateKey, publicKey: pair.publicKey, publicRaw };
}

export async function importDevicePublicKey(publicRaw: Uint8Array): Promise<CryptoKey> {
  return crypto.subtle.importKey('raw', publicRaw as BufferSource, { name: 'ECDH', namedCurve: 'P-256' }, true, []);
}

/** ECDH agreement. Both sides reach the same 32 bytes, a server never sees them. */
export async function sharedSecret(privateKey: CryptoKey, publicKey: CryptoKey): Promise<Uint8Array> {
  const bits = await crypto.subtle.deriveBits({ name: 'ECDH', public: publicKey }, privateKey, 256);
  return new Uint8Array(bits);
}

/** HKDF-SHA256. Room and invite keys are stretched into separate subkeys here. */
export async function hkdf(
  secret: Uint8Array,
  salt: Uint8Array,
  info: string,
  length = 32,
): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey('raw', secret as BufferSource, 'HKDF', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits(
    { name: 'HKDF', hash: 'SHA-256', salt: salt as BufferSource, info: enc.encode(info) },
    key,
    length * 8,
  );
  return new Uint8Array(bits);
}

export async function hmacKey(raw: Uint8Array): Promise<CryptoKey> {
  return crypto.subtle.importKey('raw', raw as BufferSource, { name: 'HMAC', hash: 'SHA-256' }, false, [
    'sign',
    'verify',
  ]);
}

export const ROOM_KEY_BYTES = 32;

export function generateRoomKey(): Uint8Array {
  return randomBytes(ROOM_KEY_BYTES);
}

const ROOM_SALT = enc.encode('oyw/room/v1');

/**
 * The room id every member computes from the room key. Same key, same id,
 * and the server never has to be told what the room is called.
 */
export async function deriveRoomId(roomKey: Uint8Array): Promise<string> {
  const key = await hmacKey(roomKey);
  const mac = new Uint8Array(await crypto.subtle.sign('HMAC', key, enc.encode('room-id')));
  return toBase64Url(mac.slice(0, 16));
}

/**
 * The id used for signaling. It rotates every day, so the matchmaker cannot
 * follow a room over time, and every member still lands on the same one.
 */
export async function deriveSignalingId(roomKey: Uint8Array, date: Date): Promise<string> {
  const key = await hmacKey(roomKey);
  const day = date.toISOString().slice(0, 10);
  const mac = new Uint8Array(await crypto.subtle.sign('HMAC', key, enc.encode(`signaling-id|${day}`)));
  return toBase64Url(mac.slice(0, 16));
}

/** Subkey that MACs Yjs updates. Shared by everyone in the room, so it proves nothing about authorship. */
export async function roomMacKey(roomKey: Uint8Array): Promise<CryptoKey> {
  return hmacKey(await hkdf(roomKey, ROOM_SALT, 'update-mac'));
}

/** Subkey that encrypts room content at rest and in the mailbox. */
export async function roomContentKey(roomKey: Uint8Array): Promise<CryptoKey> {
  const raw = await hkdf(roomKey, ROOM_SALT, 'content');
  return crypto.subtle.importKey('raw', raw as BufferSource, 'AES-GCM', false, ['encrypt', 'decrypt']);
}
