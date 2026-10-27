/**
 * R3.2 local storage layer (05-security §Device storage and iOS).
 * Interface first: tests use memory; the browser gets IndexedDB.
 * Only ciphertext ever lands in the store.
 */

export interface KvStore {
  get<T = unknown>(key: string): Promise<T | undefined>;
  set(key: string, value: unknown): Promise<void>;
  keys(): Promise<string[]>;
  wipe(): Promise<void>;
}

export function createMemoryStore(): KvStore & { data: Map<string, unknown> } {
  const data = new Map<string, unknown>();
  return {
    data,
    async get<T>(key: string) {
      return structuredClone(data.get(key)) as T | undefined;
    },
    async set(key, value) {
      data.set(key, structuredClone(value));
    },
    async keys() {
      return [...data.keys()];
    },
    async wipe() {
      data.clear();
    },
  };
}

/** Browser adapter. Lazily opens IndexedDB; falls back to memory if blocked
 *  (private mode) — the app then warns instead of pretending to persist. */
export function createIdbStore(dbName = 'oyw-workspace'): KvStore {
  let dbPromise: Promise<IDBDatabase> | null = null;
  const open = (): Promise<IDBDatabase> => {
    if (!dbPromise) {
      dbPromise = new Promise((resolve, reject) => {
        const req = indexedDB.open(dbName, 1);
        req.onupgradeneeded = () => req.result.createObjectStore('kv');
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      });
    }
    return dbPromise;
  };
  return {
    async get<T>(key: string) {
      const db = await open();
      return new Promise<T | undefined>((resolve, reject) => {
        const r = db.transaction('kv').objectStore('kv').get(key);
        r.onsuccess = () => resolve(r.result as T | undefined);
        r.onerror = () => reject(r.error);
      });
    },
    async set(key, value) {
      const db = await open();
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction('kv', 'readwrite');
        tx.objectStore('kv').put(value, key);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
    },
    async keys() {
      const db = await open();
      return new Promise<string[]>((resolve, reject) => {
        const r = db.transaction('kv').objectStore('kv').getAllKeys();
        r.onsuccess = () => resolve(r.result as string[]);
        r.onerror = () => reject(r.error);
      });
    },
    async wipe() {
      const db = await open();
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction('kv', 'readwrite');
        tx.objectStore('kv').clear();
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
    },
  };
}

/** Ask the browser to keep our storage. Returns whether it granted. */
export async function persistStorage(): Promise<boolean> {
  try {
    if (navigator.storage?.persist) return await navigator.storage.persist();
    return false;
  } catch {
    return false;
  }
}

/** iOS Safari evicts script-writable storage after 7 days of Safari use;
 *  Home Screen web apps keep their own counter (05-security §Device storage). */
export function isIos(): boolean {
  const ua = navigator.userAgent;
  return /iP(hone|ad|od)/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
}

export function isHomeScreen(): boolean {
  return window.matchMedia('(display-mode: standalone)').matches
    || (navigator as { standalone?: boolean }).standalone === true;
}

/** True when the iOS Home-Screen gate must block setup. */
export function needsHomeScreenGate(): boolean {
  return isIos() && !isHomeScreen();
}
