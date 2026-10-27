/**
 * R3.9 the client for the sync server.
 *
 * The room document travels as Yjs updates. Every update is sealed with a
 * key derived from the room key, so the server carries ciphertext it
 * cannot open. The queue label is derived from the same room key, so the
 * server cannot even tell one committee from another.
 *
 * The server is a pipe. It never sees a name, a rating or a note.
 */
import * as Y from 'yjs';

import { queueLabel } from './mailbox';

/** The queue takes the biggest padded bucket, and the base64 of it. */
const MAX_BLOB_CHARS = 88_000;

const enc = new TextEncoder();
const dec = new TextDecoder();

/** The sync key comes from the room key, so a member who has the room key has the sync key. */
export async function deriveSyncKey(roomKey: Uint8Array): Promise<CryptoKey> {
  const material = await crypto.subtle.importKey('raw', roomKey as BufferSource, 'HKDF', false, [
    'deriveKey',
  ]);
  return crypto.subtle.deriveKey(
    { name: 'HKDF', hash: 'SHA-256', salt: enc.encode('oyw/sync/v1'), info: enc.encode('room') },
    material,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}

export interface SyncEnvelope {
  v: 1;
  /** Who sent it. So a device can skip its own echo. */
  from: string;
  /** The Yjs update, base64. */
  update: string;
}

function toBase64(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function fromBase64(value: string): Uint8Array {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

/** Seals one update under the sync key. */
export async function sealUpdate(
  key: CryptoKey,
  update: Uint8Array,
  from: string,
): Promise<string> {
  const envelope: SyncEnvelope = { v: 1, from, update: toBase64(update) };
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const cipher = new Uint8Array(
    await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv, additionalData: enc.encode('oyw/sync/v1') },
      key,
      enc.encode(JSON.stringify(envelope)) as BufferSource,
    ),
  );
  const out = new Uint8Array(iv.length + cipher.length);
  out.set(iv);
  out.set(cipher, iv.length);
  return toBase64(out);
}

/** Opens a sealed update. Throws when the key does not fit. */
export async function openUpdate(
  key: CryptoKey,
  blob: string,
): Promise<{ from: string; update: Uint8Array }> {
  const bytes = fromBase64(blob);
  const plain = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: bytes.slice(0, 12), additionalData: enc.encode('oyw/sync/v1') },
    key,
    bytes.slice(12) as BufferSource,
  );
  const envelope = JSON.parse(dec.decode(plain)) as SyncEnvelope;
  return { from: envelope.from, update: fromBase64(envelope.update) };
}

export interface SyncOptions {
  /** The sync server, for example https://sync.example.org. */
  serverUrl: string;
  roomKey: Uint8Array;
  memberId: string;
  /** How often to pull, in milliseconds. */
  pollMs?: number;
  /** How long to wait before posting after a change, in milliseconds. */
  debounceMs?: number;
  /** Injected for the tests. */
  fetchImpl?: typeof fetch;
  now?: () => Date;
  /** Called after an update came in, so the app can save it. */
  onApplied?: () => void;
}

export interface SyncStatus {
  /** Whether the last pull worked. */
  connected: boolean;
  /** What the server said, when it said something. */
  problem: string | null;
  /** How many updates came in. */
  received: number;
  /** How many updates went out. */
  sent: number;
}

const DEFAULT_POLL_MS = 15_000;
const DEFAULT_DEBOUNCE_MS = 2_000;

/**
 * Keeps one room document in step with the other devices.
 *
 * It pulls on a timer and pushes on a change. The updates it sent are
 * remembered so it does not apply its own echo.
 */
export class SyncClient {
  private readonly options: Required<Omit<SyncOptions, 'fetchImpl' | 'now' | 'onApplied'>> &
    Pick<SyncOptions, 'fetchImpl' | 'now' | 'onApplied'>;
  private key: CryptoKey | null = null;
  private timer: ReturnType<typeof setInterval> | null = null;
  private debounce: ReturnType<typeof setTimeout> | null = null;
  private seen = new Set<string>();
  private since = 0;
  private stopped = false;

  readonly status: SyncStatus = { connected: false, problem: null, received: 0, sent: 0 };

  constructor(options: SyncOptions) {
    this.options = {
      serverUrl: options.serverUrl.replace(/\/+$/, ''),
      roomKey: options.roomKey,
      memberId: options.memberId,
      pollMs: options.pollMs ?? DEFAULT_POLL_MS,
      debounceMs: options.debounceMs ?? DEFAULT_DEBOUNCE_MS,
      fetchImpl: options.fetchImpl,
      now: options.now,
      onApplied: options.onApplied,
    };
  }

  private get fetchImpl(): typeof fetch {
    return this.options.fetchImpl ?? globalThis.fetch;
  }

  /**
   * The fetch call, with the right receiver. The browser's fetch needs the
   * window as its receiver, so it is called on the global object and never
   * as a method of this class.
   */
  private async request(url: string, init?: RequestInit): Promise<Response> {
    const impl = this.options.fetchImpl;
    if (impl) return impl(url, init);
    return globalThis.fetch(url, init);
  }

  private get today(): Date {
    return this.options.now ? this.options.now() : new Date();
  }

  /** Starts pulling and pushing. The document is the one that changes. */
  async start(doc: Y.Doc): Promise<void> {
    this.key = await deriveSyncKey(this.options.roomKey);
    this.stopped = false;
    doc.on('update', this.onUpdate);
    await this.pull(doc);
    // Announce what this device already has, so a device that joins picks
    // up the rest of the chart.
    await this.push(Y.encodeStateAsUpdate(doc));
    this.timer = setInterval(() => {
      void this.pull(doc);
    }, this.options.pollMs);
  }

  stop(): void {
    this.stopped = true;
    if (this.timer !== null) clearInterval(this.timer);
    if (this.debounce !== null) clearTimeout(this.debounce);
    this.timer = null;
    this.debounce = null;
  }

  private onUpdate = (update: Uint8Array, origin: unknown): void => {
    if (origin === 'sync') return;
    // Yjs sends one update per change, and adding a coworker is several
    // changes. They are merged before they go out, so the other devices
    // never get half a coworker.
    this.pending.push(update);
    if (this.debounce !== null) clearTimeout(this.debounce);
    this.debounce = setTimeout(() => {
      void this.flush();
    }, this.options.debounceMs);
  };

  /** Sends everything that piled up. */
  private async flush(): Promise<void> {
    if (!this.pending.length) return;
    const batch = this.pending;
    this.pending = [];
    const merged = Y.mergeUpdates(batch);
    const sent = await this.push(merged);
    if (!sent) {
      // Keep them for the next try, so a dropped connection does not lose
      // a change.
      this.pending = [...batch, ...this.pending];
    }
  }

  /** The queue label for today. It changes every day on purpose. */
  async label(): Promise<string> {
    return queueLabel(this.options.roomKey, this.today);
  }

  private pending: Uint8Array[] = [];

  private async push(update: Uint8Array): Promise<boolean> {
    if (!this.key || this.stopped) return false;
    try {
      const label = await this.label();
      const blob = await sealUpdate(this.key, update, this.options.memberId);
      // The queue takes the biggest padded bucket. A chart that does not
      // fit is a problem for the room, not for the pipe.
      if (blob.length > MAX_BLOB_CHARS) {
        throw new Error('this update is too big for the queue');
      }
      const response = await this.request(
        `${this.options.serverUrl}/mailbox/queue?label=${encodeURIComponent(label)}`,
        {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ label, blob, expires_at: Date.now() + 31 * 24 * 60 * 60 * 1000 }),
        },
      );
      if (!response.ok) throw new Error(`the server said ${response.status}`);
      this.seen.add(blob);
      this.status.sent += 1;
      this.status.connected = true;
      this.status.problem = null;
      return true;
    } catch (error) {
      this.status.connected = false;
      this.status.problem = error instanceof Error ? error.message : String(error);
      return false;
    }
  }

  /** Pulls what the other devices sent and applies it. */
  async pull(doc: Y.Doc): Promise<void> {
    if (!this.key || this.stopped) return;
    try {
      const label = await this.label();
      const response = await this.request(
        `${this.options.serverUrl}/mailbox/queue?label=${encodeURIComponent(label)}&since=${this.since}`,
      );
      if (!response.ok) throw new Error(`the server said ${response.status}`);
      const body = (await response.json()) as { items?: { blob: string; seq: number }[] };
      for (const item of body.items ?? []) {
        this.since = Math.max(this.since, item.seq);
        if (this.seen.has(item.blob)) continue;
        this.seen.add(item.blob);
        try {
          const { from, update } = await openUpdate(this.key, item.blob);
          if (from === this.options.memberId) continue;
          Y.applyUpdate(doc, update, 'sync');
          this.status.received += 1;
          this.options.onApplied?.();
        } catch {
          // A blob that does not open is not ours. Skip it.
        }
      }
      this.status.connected = true;
      this.status.problem = null;
    } catch (error) {
      this.status.connected = false;
      this.status.problem = error instanceof Error ? error.message : String(error);
    }
  }
}
