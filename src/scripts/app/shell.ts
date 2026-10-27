/**
 * The app shell: the disguise, the lock button and the auto-lock.
 */
import { lockSession, readSettings } from '../../lib/workspace/app-state';
import { all, el, lockPath } from './shared';

function applyDisguise(): void {
  const settings = readSettings();
  for (const node of all<HTMLElement>('[data-screen-name]')) {
    node.textContent = settings.screenName;
  }
  document.title = settings.screenName;
}

applyDisguise();

el<HTMLButtonElement>('[data-lock]')?.addEventListener('click', () => {
  lockSession();
  location.replace(lockPath());
});

/** Five minutes of nothing and the app closes itself. */
const IDLE_MS = 5 * 60 * 1000;
const HIDDEN_MS = 60 * 1000;
let timer = window.setTimeout(lockNow, IDLE_MS);

function lockNow(): void {
  lockSession();
  location.replace(lockPath());
}

function resetIdle(): void {
  window.clearTimeout(timer);
  timer = window.setTimeout(lockNow, IDLE_MS);
}

for (const event of ['pointerdown', 'keydown']) {
  document.addEventListener(event, resetIdle, { passive: true });
}

// Left in the background, the app locks sooner: a work phone with the app
// open in another window is a risk.
document.addEventListener('visibilitychange', () => {
  window.clearTimeout(timer);
  timer = window.setTimeout(
    lockNow,
    document.visibilityState === 'hidden' ? HIDDEN_MS : IDLE_MS,
  );
});
