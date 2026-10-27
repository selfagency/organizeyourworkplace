/**
 * The app's local state (R3.2 storage, R3.3 room model).
 *
 * Everything the committee keeps lives on the device: the room document,
 * the room key, and the member's own id. The store holds ciphertext only,
 * sealed under a key derived from the passphrase the member typed.
 *
 * Nothing here talks to a server. The sync layer, when it lands, reads the
 * same document.
 */
import * as Y from 'yjs';

import { openJson, sealJson } from './crypto';
import { fromBase64Url, generateRoomKey, toBase64Url } from './keys';
import { createIdbStore, type KvStore } from './storage';

const WORKSPACE_KEY = 'workspace';
const WORKSPACE_SALT_KEY = 'workspace-salt';
const SETTINGS_KEY = 'settings';
const SESSION_KEY = 'oyw-workspace-session';
const DB_NAME = 'oyw-workspace';

const PBKDF2_ITERATIONS = 600_000;

export interface StoredWorkspace {
  version: 1;
  memberId: string;
  roomId: string;
  roomKeyB64: string;
  updateB64: string;
}

export interface AppSettings {
  /** The name the lock screen shows. A work phone shows it in the tab. */
  screenName: string;
}

export const DEFAULT_SETTINGS: AppSettings = { screenName: 'Notes' };

export interface Session {
  memberId: string;
  roomId: string;
  roomKey: Uint8Array;
  doc: Y.Doc;
  /** Writes the document back to the device, sealed. */
  save(): Promise<void>;
}

let openStore: KvStore | null = null;

function store(): KvStore {
  if (!openStore) openStore = createIdbStore(DB_NAME);
  return openStore;
}

/**
 * The passphrase becomes an AES-GCM key. The bytes are kept for the tab
 * session so a member does not type the passphrase on every screen, and
 * they never leave the device.
 */
async function deriveSessionKey(
  passphrase: string,
  salt: Uint8Array,
): Promise<{ raw: Uint8Array; key: CryptoKey }> {
  const enc = new TextEncoder();
  const material = await crypto.subtle.importKey('raw', enc.encode(passphrase), 'PBKDF2', false, [
    'deriveBits',
  ]);
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt: salt as BufferSource, iterations: PBKDF2_ITERATIONS, hash: 'SHA-256' },
    material,
    256,
  );
  const raw = new Uint8Array(bits);
  const key = await crypto.subtle.importKey('raw', raw as BufferSource, 'AES-GCM', true, [
    'encrypt',
    'decrypt',
  ]);
  return { raw, key };
}

/** Settings are not secret, so they live in plain local storage. */
export function readSettings(): AppSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return { ...DEFAULT_SETTINGS };
    return { ...DEFAULT_SETTINGS, ...(JSON.parse(raw) as Partial<AppSettings>) };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function writeSettings(settings: Partial<AppSettings>): AppSettings {
  const next = { ...readSettings(), ...settings };
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(next));
  } catch {
    // A phone in private mode refuses local storage. The app still works,
    // the disguise just does not stick.
  }
  return next;
}

/** True when this device already holds a workspace. */
export async function hasWorkspace(): Promise<boolean> {
  const blob = await store().get<ArrayBuffer>(WORKSPACE_KEY);
  return Boolean(blob);
}

async function saveStored(value: StoredWorkspace, key: CryptoKey): Promise<void> {
  await store().set(WORKSPACE_KEY, await sealJson(value, key));
}

function writeSession(value: StoredWorkspace, keyBytes: Uint8Array): void {
  try {
    sessionStorage.setItem(
      SESSION_KEY,
      JSON.stringify({
        keyB64: toBase64Url(keyBytes),
        memberId: value.memberId,
        roomId: value.roomId,
      }),
    );
  } catch {
    // No session storage: the member types the passphrase on every screen.
  }
}

/** Forgets the unlocked session. The data stays, sealed. */
export function lockSession(): void {
  try {
    sessionStorage.removeItem(SESSION_KEY);
  } catch {
    // Nothing to remove.
  }
  openStore?.close();
  openStore = null;
}

function buildSession(stored: StoredWorkspace, key: CryptoKey): Session {
  const roomKey = fromBase64Url(stored.roomKeyB64);
  const doc = new Y.Doc();
  Y.applyUpdate(doc, fromBase64Url(stored.updateB64));
  return {
    memberId: stored.memberId,
    roomId: stored.roomId,
    roomKey,
    doc,
    async save() {
      await saveStored(
        {
          ...stored,
          roomKeyB64: toBase64Url(roomKey),
          updateB64: toBase64Url(Y.encodeStateAsUpdate(doc)),
        },
        key,
      );
    },
  };
}

/**
 * Sets up this device. The passphrase becomes the key that seals everything
 * stored here, so a lost passphrase means a lost drive.
 */
export async function createWorkspace(
  passphrase: string,
  options: { memberId?: string; roomId?: string } = {},
): Promise<Session> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const { raw, key } = await deriveSessionKey(passphrase, salt);
  const memberId = options.memberId ?? `m-${toBase64Url(crypto.getRandomValues(new Uint8Array(6)))}`;
  const roomId = options.roomId ?? `r-${toBase64Url(crypto.getRandomValues(new Uint8Array(8)))}`;
  const roomKey = generateRoomKey();
  const doc = new Y.Doc();
  const stored: StoredWorkspace = {
    version: 1,
    memberId,
    roomId,
    roomKeyB64: toBase64Url(roomKey),
    updateB64: toBase64Url(Y.encodeStateAsUpdate(doc)),
  };
  await store().set(WORKSPACE_SALT_KEY, salt);
  await saveStored(stored, key);
  writeSession(stored, raw);
  return buildSession(stored, key);
}

/** Opens the workspace on this device. */
export async function unlockWorkspace(passphrase: string): Promise<Session> {
  const salt = await store().get<Uint8Array>(WORKSPACE_SALT_KEY);
  if (!salt) throw new Error('no workspace on this device');
  const { raw, key } = await deriveSessionKey(passphrase, salt);
  const blob = await store().get<ArrayBuffer>(WORKSPACE_KEY);
  if (!blob) throw new Error('no workspace on this device');
  let stored: StoredWorkspace;
  try {
    stored = await openJson<StoredWorkspace>(blob, key);
  } catch {
    throw new Error('wrong passphrase');
  }
  writeSession(stored, raw);
  return buildSession(stored, key);
}

/**
 * Reopens the workspace from the tab session, without asking for the
 * passphrase again. Returns null when the session is gone.
 */
export async function resumeSession(): Promise<Session | null> {
  let raw: string | null = null;
  try {
    raw = sessionStorage.getItem(SESSION_KEY);
  } catch {
    return null;
  }
  if (!raw) return null;
  try {
    const saved = JSON.parse(raw) as {
      saltB64: string;
      keyB64: string;
      memberId: string;
      roomId: string;
    };
    const keyBytes = fromBase64Url(saved.keyB64);
    const key = await crypto.subtle.importKey('raw', keyBytes as BufferSource, 'AES-GCM', false, [
      'encrypt',
      'decrypt',
    ]);
    const blob = await store().get<ArrayBuffer>(WORKSPACE_KEY);
    if (!blob) return null;
    const stored = await openJson<StoredWorkspace>(blob, key);
    return buildSession(stored, key);
  } catch {
    return null;
  }
}

/** Erases everything this device holds. */
export async function wipeDevice(): Promise<void> {
  await store().wipe();
  lockSession();
  try {
    localStorage.removeItem(SETTINGS_KEY);
  } catch {
    // Nothing to remove.
  }
}

/** Re-runs the page when the document changes, so the screen keeps up. */
export function onDocChange(doc: Y.Doc, handler: () => void): () => void {
  const observer = () => handler();
  doc.on('update', observer);
  return () => doc.off('update', observer);
}
