/**
 * R3.4 one-time invites (05-security §Invites).
 *
 * The flow the spec asks for: a core member creates a link, the secret sits
 * after the `#`, the new member opens it on their own phone, the app strips
 * the fragment from history, both sides compare a 4-word code, the inviter
 * approves, the room key is handed over encrypted to the new device, and the
 * invite dies.
 *
 * Two things are proved separately. The invite secret proves the requester
 * holds the link, so the inviter can ignore a stranger. The 4-word code proves
 * the requester is talking to the real inviter and not to a relay, because
 * both sides derive it from an ECDH agreement the relay cannot compute.
 */
import { openBytes, openJson, sealBytes, sealJson } from './crypto';
import {
  fromBase64Url,
  hkdf,
  hmacKey,
  importDevicePublicKey,
  randomBytes,
  sharedSecret,
  toBase64Url,
} from './keys';
import type { KvStore } from './storage';
import { CHECK_WORDS, type CheckWord } from './wordlist';

const enc = new TextEncoder();

export type Tier = 'core' | 'point' | 'committee';

export type InviteState = 'pending' | 'used' | 'revoked' | 'expired';

export interface InviteRecord {
  id: string;
  /** Capability value. Never leaves the inviter's device except in the link fragment. */
  secretB64: string;
  inviterPublicB64: string;
  roomId: string;
  tier: Tier;
  createdAt: number;
  expiresAt: number;
  state: InviteState;
}

export interface ParsedInvite {
  id: string;
  inviterPublicB64: string;
  secretB64: string;
}

export interface JoinRequest {
  inviteId: string;
  devicePublicB64: string;
  nonceB64: string;
  macB64: string;
}

export interface CheckCode {
  indices: number[];
  words: CheckWord[];
}

export interface KeyResponse {
  inviteId: string;
  roomId: string;
  tier: Tier;
  wrappedRoomKeyB64: string;
}

export type InviteErrorCode =
  | 'malformed'
  | 'not_found'
  | 'dead'
  | 'expired'
  | 'unauthorized'
  | 'wrong_invite'
  | 'check_not_confirmed';

export class InviteError extends Error {
  readonly code: InviteErrorCode;

  constructor(code: InviteErrorCode, message?: string) {
    super(message ?? code);
    this.name = 'InviteError';
    this.code = code;
  }
}

export const INVITE_TTL_MS = 24 * 60 * 60 * 1000;

const FRAGMENT_VERSION = 'v1';
const AUTH_INFO = 'oyw/invite/auth/v1';
const WRAP_INFO = 'oyw/invite/keywrap/v1';
const INVITE_PREFIX = 'invite:';

function concat(...parts: Uint8Array[]): Uint8Array {
  const total = parts.reduce((sum, part) => sum + part.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.length;
  }
  return out;
}

function asArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  return bytes.slice().buffer as ArrayBuffer;
}

export function createInvite(input: {
  roomId: string;
  tier: Tier;
  inviterPublicRaw: Uint8Array;
  now?: number;
  ttlMs?: number;
}): InviteRecord {
  const now = input.now ?? Date.now();
  return {
    id: toBase64Url(randomBytes(9)),
    secretB64: toBase64Url(randomBytes(32)),
    inviterPublicB64: toBase64Url(input.inviterPublicRaw),
    roomId: input.roomId,
    tier: input.tier,
    createdAt: now,
    expiresAt: now + (input.ttlMs ?? INVITE_TTL_MS),
    state: 'pending',
  };
}

/** The part after the `#`. Browsers never send it to a server. */
export function inviteFragment(record: InviteRecord): string {
  return [FRAGMENT_VERSION, record.id, record.inviterPublicB64, record.secretB64].join('.');
}

export function parseInviteFragment(fragment: string): ParsedInvite {
  const parts = fragment.replace(/^#/, '').split('.');
  if (parts.length !== 4) throw new InviteError('malformed', 'not an invite link');
  const [version, id, inviterPublicB64, secretB64] = parts;
  if (version !== FRAGMENT_VERSION) throw new InviteError('malformed', 'unknown invite version');
  if (!id || !inviterPublicB64 || !secretB64) throw new InviteError('malformed', 'incomplete invite link');
  return { id, inviterPublicB64, secretB64 };
}

export interface HistoryLike {
  replaceState(data: unknown, unused: string, url?: string): void;
}

/**
 * Drops the fragment from the address bar and from history. Browser history
 * can sync to an employer's profile, so the secret must not survive the join.
 */
export function stripFragmentFromUrl(url: string, history: HistoryLike): string {
  const parsed = new URL(url, 'https://app.invalid');
  const cleaned = `${parsed.pathname}${parsed.search}`;
  history.replaceState(null, '', cleaned);
  return cleaned;
}

async function authKey(secretB64: string, inviteId: string): Promise<CryptoKey> {
  const stretched = await hkdf(fromBase64Url(secretB64), enc.encode(inviteId), AUTH_INFO);
  return hmacKey(stretched);
}

async function requestMac(
  invite: ParsedInvite,
  devicePublicRaw: Uint8Array,
  nonce: Uint8Array,
): Promise<Uint8Array> {
  const key = await authKey(invite.secretB64, invite.id);
  const payload = concat(enc.encode(invite.id), devicePublicRaw, nonce);
  return new Uint8Array(await crypto.subtle.sign('HMAC', key, payload as BufferSource));
}

export async function buildJoinRequest(
  invite: ParsedInvite,
  devicePublicRaw: Uint8Array,
): Promise<JoinRequest> {
  const nonce = randomBytes(16);
  const mac = await requestMac(invite, devicePublicRaw, nonce);
  return {
    inviteId: invite.id,
    devicePublicB64: toBase64Url(devicePublicRaw),
    nonceB64: toBase64Url(nonce),
    macB64: toBase64Url(mac),
  };
}

export interface VerifiedRequest {
  devicePublicRaw: Uint8Array;
  shared: Uint8Array;
}

/** Inviter side. A request without the invite secret is refused. */
export async function verifyJoinRequest(
  invite: ParsedInvite,
  inviterPrivateKey: CryptoKey,
  request: JoinRequest,
): Promise<VerifiedRequest> {
  if (request.inviteId !== invite.id) throw new InviteError('wrong_invite');
  const devicePublicRaw = fromBase64Url(request.devicePublicB64);
  const nonce = fromBase64Url(request.nonceB64);
  const mac = fromBase64Url(request.macB64);
  const key = await authKey(invite.secretB64, invite.id);
  const payload = concat(enc.encode(invite.id), devicePublicRaw, nonce);
  const valid = await crypto.subtle.verify('HMAC', key, mac as BufferSource, payload as BufferSource);
  if (!valid) throw new InviteError('unauthorized', 'join request does not match this invite');
  const shared = await sharedSecret(inviterPrivateKey, await importDevicePublicKey(devicePublicRaw));
  return { devicePublicRaw, shared };
}

/** Invitee side. The same agreement, reached from the other private key. */
export async function inviteeSharedSecret(
  invite: ParsedInvite,
  devicePrivateKey: CryptoKey,
): Promise<Uint8Array> {
  const inviterPublic = await importDevicePublicKey(fromBase64Url(invite.inviterPublicB64));
  return sharedSecret(devicePrivateKey, inviterPublic);
}

/**
 * 32 bits of code: one byte per word, taken from an HMAC over the session
 * transcript. Both sides reach the same words, a relay cannot.
 */
export async function computeCheckCode(
  shared: Uint8Array,
  inviteId: string,
  inviterPublicRaw: Uint8Array,
  inviteePublicRaw: Uint8Array,
): Promise<CheckCode> {
  const transcript = concat(enc.encode(inviteId), inviterPublicRaw, inviteePublicRaw);
  const digest = new Uint8Array(
    await crypto.subtle.sign('HMAC', await hmacKey(shared), transcript as BufferSource),
  );
  const indices = [digest[0], digest[1], digest[2], digest[3]];
  const words = indices.map((index) => CHECK_WORDS[index]);
  return { indices, words };
}

/**
 * The number is the code, the word is what people say. A pair reading in
 * different languages compares the numbers.
 */
export function formatCheckCode(code: CheckCode, lang: 'en' | 'es'): string {
  return code.words.map((word, i) => `${code.indices[i]} ${word[lang]}`).join(' · ');
}

async function wrapKey(shared: Uint8Array, inviteId: string): Promise<CryptoKey> {
  const stretched = await hkdf(shared, enc.encode(inviteId), WRAP_INFO);
  return crypto.subtle.importKey('raw', stretched as BufferSource, 'AES-GCM', false, ['encrypt', 'decrypt']);
}

export async function sealRoomKeyForDevice(
  roomKey: Uint8Array,
  shared: Uint8Array,
  inviteId: string,
): Promise<string> {
  const sealed = await sealBytes(roomKey, await wrapKey(shared, inviteId));
  return toBase64Url(new Uint8Array(sealed));
}

export async function openRoomKeyForDevice(
  wrappedB64: string,
  shared: Uint8Array,
  inviteId: string,
): Promise<Uint8Array> {
  const opened = await openBytes(
    asArrayBuffer(fromBase64Url(wrappedB64)),
    await wrapKey(shared, inviteId),
  );
  return opened;
}

export interface InviteVault {
  store: KvStore;
  /** Passphrase-derived key. The invite record is ciphertext at rest. */
  key: CryptoKey;
}

export async function saveInvite(vault: InviteVault, record: InviteRecord): Promise<void> {
  await vault.store.set(INVITE_PREFIX + record.id, await sealJson(record, vault.key));
}

export async function loadInvite(vault: InviteVault, id: string): Promise<InviteRecord | undefined> {
  const blob = await vault.store.get<ArrayBuffer>(INVITE_PREFIX + id);
  if (!blob) return undefined;
  return openJson<InviteRecord>(blob, vault.key);
}

export async function listInvites(vault: InviteVault): Promise<InviteRecord[]> {
  const keys = await vault.store.keys();
  const records: InviteRecord[] = [];
  for (const key of keys.filter((name) => name.startsWith(INVITE_PREFIX))) {
    const record = await loadInvite(vault, key.slice(INVITE_PREFIX.length));
    if (record) records.push(record);
  }
  return records;
}

export async function revokeInvite(vault: InviteVault, id: string): Promise<void> {
  const record = await loadInvite(vault, id);
  if (!record) throw new InviteError('not_found');
  await saveInvite(vault, { ...record, state: 'revoked' });
}

export interface Approval {
  vault: InviteVault;
  inviteId: string;
  inviterPrivateKey: CryptoKey;
  request: JoinRequest;
  roomKey: Uint8Array;
  /** The human comparison happened. The app asks for this before approving. */
  checkCodeConfirmed: boolean;
  now?: number;
}

/**
 * Hands the room key to the new device and kills the invite. An invite is
 * good for one approval, and only inside its 24 hours.
 */
export async function approveInvite(approval: Approval): Promise<KeyResponse> {
  const record = await loadInvite(approval.vault, approval.inviteId);
  if (!record) throw new InviteError('not_found');
  if (record.state === 'used' || record.state === 'revoked') throw new InviteError('dead');
  const now = approval.now ?? Date.now();
  if (now >= record.expiresAt) {
    await saveInvite(approval.vault, { ...record, state: 'expired' });
    throw new InviteError('expired');
  }
  if (!approval.checkCodeConfirmed) throw new InviteError('check_not_confirmed');
  const invite: ParsedInvite = {
    id: record.id,
    inviterPublicB64: record.inviterPublicB64,
    secretB64: record.secretB64,
  };
  const verified = await verifyJoinRequest(invite, approval.inviterPrivateKey, approval.request);
  const wrapped = await sealRoomKeyForDevice(approval.roomKey, verified.shared, record.id);
  await saveInvite(approval.vault, { ...record, state: 'used' });
  return {
    inviteId: record.id,
    roomId: record.roomId,
    tier: record.tier,
    wrappedRoomKeyB64: wrapped,
  };
}

export async function acceptKeyResponse(
  invite: ParsedInvite,
  devicePrivateKey: CryptoKey,
  response: KeyResponse,
): Promise<Uint8Array> {
  if (response.inviteId !== invite.id) throw new InviteError('wrong_invite');
  const shared = await inviteeSharedSecret(invite, devicePrivateKey);
  return openRoomKeyForDevice(response.wrappedRoomKeyB64, shared, invite.id);
}
