/**
 * R3.6 mailbox protocol, client side (05-security §Mailbox).
 *
 * The server holds ciphertext it cannot read. What it can see is a queue
 * label that rotates daily, the size bucket of the blob, and when it
 * arrived. Messages are sealed to one-time prekeys, so a device seized
 * later cannot open the messages that were already queued.
 */
import { fromBase64Url, hkdf, importDevicePublicKey, randomBytes, sharedSecret, toBase64Url } from './keys';
import { openBytes, sealBytes } from './crypto';

const enc = new TextEncoder();

export const MAILBOX_LABEL_INFO = 'oyw/mailbox/label/v1';
export const MAILBOX_MESSAGE_INFO = 'oyw/mailbox/message/v1';

/** The server refuses anything older than this, whatever the client asks for. */
export const MAX_RETENTION_MS = 31 * 24 * 60 * 60 * 1000;

export const RETENTION_OPTIONS = [
  { id: '1w', label: '1 week', ms: 7 * 24 * 60 * 60 * 1000 },
  { id: '2w', label: '2 weeks', ms: 14 * 24 * 60 * 60 * 1000 },
  { id: '1m', label: '1 month', ms: 30 * 24 * 60 * 60 * 1000 },
] as const;

export type RetentionId = (typeof RETENTION_OPTIONS)[number]['id'];

export function retentionMs(id: RetentionId): number {
  const option = RETENTION_OPTIONS.find((entry) => entry.id === id);
  if (!option) throw new Error(`unknown retention ${id}`);
  return option.ms;
}

export function expiresAt(now: number, id: RetentionId): number {
  return now + retentionMs(id);
}

/** The client's ask, checked against the server's cap before anything is sent. */
export function isWithinServerCap(expiry: number, now: number): boolean {
  return expiry > now && expiry - now <= MAX_RETENTION_MS;
}

function utcDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/**
 * The queue label. Only a member can compute it, and it changes every day, so
 * the server cannot follow a room over time.
 */
export async function queueLabel(roomKey: Uint8Array, date: Date): Promise<string> {
  const key = await crypto.subtle.importKey('raw', roomKey as BufferSource, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const mac = new Uint8Array(await crypto.subtle.sign('HMAC', key, enc.encode(`${MAILBOX_LABEL_INFO}|${utcDate(date)}`)));
  return toBase64Url(mac.slice(0, 16));
}

/** Fixed size buckets, so the blob length says nothing about the content. */
export const BUCKETS = [256, 512, 1024, 2048, 4096, 8192, 16384, 32768, 65536] as const;

export function bucketFor(length: number): number {
  const bucket = BUCKETS.find((size) => length <= size);
  if (!bucket) throw new Error(`message too large: ${length}`);
  return bucket;
}

export function padToBucket(bytes: Uint8Array): { blob: Uint8Array; bucket: number } {
  const bucket = bucketFor(bytes.length);
  const padded = new Uint8Array(bucket);
  padded.set(bytes);
  return { blob: padded, bucket };
}

export interface Prekey {
  id: string;
  publicB64: string;
  privateKey: CryptoKey;
  createdAt: number;
}

export interface SealedMessage {
  ephemeralPublicB64: string;
  ciphertextB64: string;
}

export async function generatePrekey(now: number): Promise<Prekey> {
  const pair = (await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, false, [
    'deriveBits',
  ])) as CryptoKeyPair;
  const publicRaw = new Uint8Array(await crypto.subtle.exportKey('raw', pair.publicKey));
  return {
    id: toBase64Url(randomBytes(9)),
    publicB64: toBase64Url(publicRaw),
    privateKey: pair.privateKey,
    createdAt: now,
  };
}

async function messageKey(shared: Uint8Array, ephemeralPublic: Uint8Array, prekeyPublic: Uint8Array): Promise<CryptoKey> {
  const salt = new Uint8Array(ephemeralPublic.length + prekeyPublic.length);
  salt.set(ephemeralPublic, 0);
  salt.set(prekeyPublic, ephemeralPublic.length);
  const stretched = await hkdf(shared, salt, MAILBOX_MESSAGE_INFO);
  return crypto.subtle.importKey('raw', stretched as BufferSource, 'AES-GCM', false, ['encrypt', 'decrypt']);
}

/** Seals a message to one prekey. The sender's own key never travels. */
export async function sealToPrekey(plaintext: Uint8Array, prekeyPublicRaw: Uint8Array): Promise<SealedMessage> {
  const ephemeral = (await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, false, [
    'deriveBits',
  ])) as CryptoKeyPair;
  const ephemeralPublic = new Uint8Array(await crypto.subtle.exportKey('raw', ephemeral.publicKey));
  const shared = await sharedSecret(ephemeral.privateKey, await importDevicePublicKey(prekeyPublicRaw));
  const key = await messageKey(shared, ephemeralPublic, prekeyPublicRaw);
  const sealed = new Uint8Array(await sealBytes(plaintext, key));
  return {
    ephemeralPublicB64: toBase64Url(ephemeralPublic),
    ciphertextB64: toBase64Url(sealed),
  };
}

/** Opens a message with the prekey it was sealed to. The prekey dies here. */
export async function openFromPrekey(sealed: SealedMessage, prekey: Prekey): Promise<Uint8Array> {
  const ephemeralPublic = fromBase64Url(sealed.ephemeralPublicB64);
  const prekeyPublic = fromBase64Url(prekey.publicB64);
  const shared = await sharedSecret(prekey.privateKey, await importDevicePublicKey(ephemeralPublic));
  const key = await messageKey(shared, ephemeralPublic, prekeyPublic);
  return openBytes(fromBase64Url(sealed.ciphertextB64).slice().buffer as ArrayBuffer, key);
}

/**
 * The prekey store. A prekey is published once and used once, so a device
 * seized later cannot open what was already queued.
 */
export interface PrekeyStore {
  list(): Prekey[];
  add(prekey: Prekey): void;
  /** Removes the prekey and hands it over, so it can never be used twice. */
  take(id: string): Prekey | undefined;
}

export function createPrekeyStore(): PrekeyStore {
  const prekeys = new Map<string, Prekey>();
  return {
    list: () => [...prekeys.values()],
    add: (prekey) => prekeys.set(prekey.id, prekey),
    take: (id) => {
      const prekey = prekeys.get(id);
      if (prekey) prekeys.delete(id);
      return prekey;
    },
  };
}
