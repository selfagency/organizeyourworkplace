/**
 * The app shell: the disguise, the lock button, the auto-lock and the
 * sync client.
 */
import { lockSession, readSettings } from '../../lib/workspace/app-state';
import { all, el, lockPath } from './shared';
import { startSync, stopSync } from './sync-client';

function applyDisguise(): void {
  const settings = readSettings();
  for (const node of all<HTMLElement>('[data-screen-name]')) {
    node.textContent = settings.screenName;
  }
  document.title = settings.screenName;
}

applyDisguise();

el<HTMLButtonElement>('[data-lock]')?.addEventListener('click', () => {
  stopSync();
  lockSession();
  location.replace(lockPath());
});

/** Five minutes of nothing and the app closes itself. */
const IDLE_MS = 5 * 60 * 1000;
const HIDDEN_MS = 60 * 1000;
let timer = setTimeout(lockNow, IDLE_MS);

function lockNow(): void {
  stopSync();
  lockSession();
  location.replace(lockPath());
}

function resetIdle(): void {
  clearTimeout(timer);
  timer = setTimeout(lockNow, IDLE_MS);
}

for (const event of ['pointerdown', 'keydown']) {
  document.addEventListener(event, resetIdle, { passive: true });
}

// Left in the background, the app locks sooner: a work phone with the app
// open in another window is a risk.
document.addEventListener('visibilitychange', () => {
  clearTimeout(timer);
  timer = setTimeout(lockNow, document.visibilityState === 'hidden' ? HIDDEN_MS : IDLE_MS);
});

// The sync client, when this device has a server.
void startSync();
