/**
 * R3.7 encrypted backups (05-security §Device storage and iOS: "A monthly
 * prompt saves an encrypted backup file to the member's own storage").
 *
 * The file holds the member's rooms and the keys they hold, sealed with a
 * passphrase. Nobody but the member can open it, not even the operator, and
 * the file is useless to whoever finds it.
 *
 * The format is a fixed header, then the salt, the iv and the ciphertext, so
 * a wrong passphrase fails in one step instead of half way through.
 */
import * as Y from 'yjs';

import { deriveKey } from './crypto';
import { fromBase64Url, toBase64Url } from './keys';

const enc = new TextEncoder();
const dec = new TextDecoder();

export const BACKUP_MAGIC = 'oywbk';
export const BACKUP_VERSION = 1;
const SALT_BYTES = 16;
const IV_BYTES = 12;

export interface BackupRoom {
  roomId: string;
  /** The room key, sealed inside the file. */
  keyB64: string;
  /** The room document, as base64 Yjs updates. */
  updates: string[];
}

export interface BackupPayload {
  version: number;
  createdAt: string;
  memberId: string;
  rooms: BackupRoom[];
}

export interface BackupFile {
  magic: string;
  version: number;
  salt: Uint8Array;
  iv: Uint8Array;
  ciphertext: Uint8Array;
}

export type BackupErrorCode = 'not_a_backup' | 'wrong_passphrase' | 'wrong_version';

export class BackupError extends Error {
  readonly code: BackupErrorCode;

  constructor(code: BackupErrorCode, message?: string) {
    super(message ?? code);
    this.name = 'BackupError';
    this.code = code;
  }
}

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

/** Packs the payload into the file format. */
export async function createBackupFile(
  payload: BackupPayload,
  passphrase: string,
): Promise<Uint8Array> {
  const salt = crypto.getRandomValues(new Uint8Array(SALT_BYTES));
  const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES));
  const key = await deriveKey(passphrase, salt);
  const plaintext = enc.encode(JSON.stringify(payload));
  const cipher = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, plaintext));
  const header = enc.encode(`${BACKUP_MAGIC}${BACKUP_VERSION}`);
  return concat(header, salt, iv, cipher);
}

/** Opens a backup. A wrong passphrase or a changed byte fails here. */
export async function openBackupFile(
  file: Uint8Array,
  passphrase: string,
): Promise<BackupPayload> {
  const headerLength = enc.encode(`${BACKUP_MAGIC}${BACKUP_VERSION}`).length;
  if (file.length < headerLength + SALT_BYTES + IV_BYTES) {
    throw new BackupError('not_a_backup');
  }
  const header = dec.decode(file.slice(0, headerLength));
  if (!header.startsWith(BACKUP_MAGIC)) throw new BackupError('not_a_backup');
  const version = Number(header.slice(BACKUP_MAGIC.length));
  if (version !== BACKUP_VERSION) throw new BackupError('wrong_version');
  const salt = file.slice(headerLength, headerLength + SALT_BYTES);
  const iv = file.slice(headerLength + SALT_BYTES, headerLength + SALT_BYTES + IV_BYTES);
  const ciphertext = file.slice(headerLength + SALT_BYTES + IV_BYTES);
  const key = await deriveKey(passphrase, salt);
  try {
    const plaintext = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ciphertext);
    return JSON.parse(dec.decode(plaintext)) as BackupPayload;
  } catch {
    throw new BackupError('wrong_passphrase');
  }
}

/** Reads the rooms out of a live workspace. */
export function captureRooms(
  memberId: string,
  rooms: { roomId: string; doc: Y.Doc; key: Uint8Array }[],
): BackupPayload {
  return {
    version: BACKUP_VERSION,
    createdAt: new Date().toISOString(),
    memberId,
    rooms: rooms.map((room) => ({
      roomId: room.roomId,
      keyB64: toBase64Url(room.key),
      updates: [toBase64Url(Y.encodeStateAsUpdate(room.doc))],
    })),
  };
}

/** Puts the rooms back, so a member can start again on a new phone. */
export function restoreRooms(payload: BackupPayload): { roomId: string; doc: Y.Doc; key: Uint8Array }[] {
  return payload.rooms.map((room) => {
    const doc = new Y.Doc();
    for (const update of room.updates) {
      Y.applyUpdate(doc, fromBase64Url(update));
    }
    return { roomId: room.roomId, doc, key: fromBase64Url(room.keyB64) };
  });
}
