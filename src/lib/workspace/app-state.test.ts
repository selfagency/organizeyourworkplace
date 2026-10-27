import { beforeEach, describe, expect, it } from 'vitest';
import 'fake-indexeddb/auto';

import {
  createWorkspace,
  hasWorkspace,
  lockSession,
  readSettings,
  resumeSession,
  unlockWorkspace,
  wipeDevice,
  writeSettings,
} from './app-state';

/** Node has no web storage, so the app gets a small one for the test. */
function memoryStorage(): Storage {
  const map = new Map<string, string>();
  return {
    get length() {
      return map.size;
    },
    clear: () => map.clear(),
    getItem: (key: string) => map.get(key) ?? null,
    key: (index: number) => [...map.keys()][index] ?? null,
    removeItem: (key: string) => map.delete(key),
    setItem: (key: string, value: string) => map.set(key, value),
  } as Storage;
}

beforeEach(() => {
  Object.defineProperty(globalThis, 'sessionStorage', { value: memoryStorage(), configurable: true });
  Object.defineProperty(globalThis, 'localStorage', { value: memoryStorage(), configurable: true });
});

/**
 * The app's device state, against a real IndexedDB. The passphrase becomes
 * the key, so the whole flow is exercised here.
 */
describe('R3.8 the app on a device', () => {
  beforeEach(async () => {
    lockSession();
    await new Promise<void>((resolve) => {
      const request = indexedDB.deleteDatabase('oyw-workspace');
      request.onsuccess = () => resolve();
      request.onerror = () => resolve();
      request.onblocked = () => resolve();
    });
  });

  it('starts with nothing on the device', async () => {
    expect(await hasWorkspace()).toBe(false);
  });

  it('creates a workspace and keeps it on the device', async () => {
    const session = await createWorkspace('a good long passphrase');
    expect(session.memberId).toBeTruthy();
    expect(session.roomId).toBeTruthy();
    expect(session.roomKey.length).toBe(32);
    expect(await hasWorkspace()).toBe(true);
  });

  it('opens again with the same passphrase', async () => {
    const created = await createWorkspace('a good long passphrase');
    await created.save();
    const opened = await unlockWorkspace('a good long passphrase');
    expect(opened.memberId).toBe(created.memberId);
    expect(opened.roomKey).toEqual(created.roomKey);
  });

  it('refuses a wrong passphrase', async () => {
    await createWorkspace('a good long passphrase');
    await expect(unlockWorkspace('the wrong passphrase')).rejects.toThrow();
  });

  it('resumes the session without the passphrase', async () => {
    const created = await createWorkspace('a good long passphrase');
    const resumed = await resumeSession();
    expect(resumed).not.toBeNull();
    expect(resumed!.memberId).toBe(created.memberId);
  });

  it('forgets the session when the app locks', async () => {
    await createWorkspace('a good long passphrase');
    lockSession();
    expect(await resumeSession()).toBeNull();
  });

  it('erases everything on the device', async () => {
    await createWorkspace('a good long passphrase');
    await wipeDevice();
    expect(await hasWorkspace()).toBe(false);
    expect(await resumeSession()).toBeNull();
  });

  it('keeps the screen name and falls back to a plain word', () => {
    expect(readSettings().screenName).toBe('Notes');
    writeSettings({ screenName: 'Recipes' });
    expect(readSettings().screenName).toBe('Recipes');
  });
}, 30_000);
