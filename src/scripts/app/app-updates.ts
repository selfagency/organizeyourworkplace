/**
 * Screen 12: App updates.
 *
 * The member taps "Check for updates". The app asks the server what the
 * newest release is, checks the signature and the log, and shows the
 * version and the release notes. Nothing is installed until the member
 * taps "Install this version", and every file is checked again after it
 * arrives. A release that fails any check is not installed, and the
 * version that is already on the phone keeps working.
 *
 * The app also keeps a copy of the version it is running, so a server
 * that is tampered with later cannot change the code on the phone. That
 * copy is made from the signed manifest, file by file, and the service
 * worker serves it in place of the network.
 */
import { appCatalogs, type AppStringKey } from '../../i18n/app';
import { APP_VERSION } from '../../app-version';
import {
  checkForUpdate,
  fetchVerifiedFiles,
  installedVersion,
  latestSource,
  sourceFor,
  verifyRelease,
  type UpdateCheck,
} from '../../lib/workspace/update';
import { fileMatches, parseManifest, type ReleaseManifest } from '../../lib/workspace/release';
import { el, lang } from './shared';

const t = (key: AppStringKey): string => appCatalogs[lang()][key];

/** The two places the app lives. The worker is registered for both. */
const SCOPES = ['/app/', '/es/app/'];

function setStatus(key: AppStringKey, extra?: string): void {
  const node = el<HTMLElement>('[data-update-status]');
  if (!node) return;
  // The string holds a {reason} placeholder for the detail.
  const text = extra ? t(key).replace('{reason}', extra) : t(key);
  node.textContent = text;
}

function setButton(label: AppStringKey | null, disabled: boolean): void {
  const button = el<HTMLButtonElement>('[data-update-check]');
  if (!button) return;
  if (label) button.textContent = t(label);
  button.disabled = disabled;
}

/** Shows the newest release and what it says. */
function showResult(check: UpdateCheck): void {
  const notes = el<HTMLElement>('[data-update-notes]');
  const install = el<HTMLButtonElement>('[data-update-install]');
  const version = el<HTMLElement>('[data-update-version]');

  if (version) version.textContent = check.latest ?? check.current;

  if (check.state === 'available') {
    setStatus('app.update.available');
    if (notes) {
      notes.textContent = check.notes?.trim() ? check.notes.trim() : t('app.update.noNotes');
      notes.hidden = false;
    }
    if (install) {
      install.hidden = false;
      install.disabled = false;
    }
    setButton('app.update.checkAgain', false);
    return;
  }

  if (check.state === 'up-to-date') {
    setStatus('app.update.upToDate');
    if (notes) notes.hidden = true;
    if (install) install.hidden = true;
    setButton('app.update.checkAgain', false);
    return;
  }

  // Broken. The reason is for the member, not for a log.
  setStatus('app.update.broken', check.reason);
  if (notes) notes.hidden = true;
  if (install) install.hidden = true;
  setButton('app.update.tryAgain', false);
}

async function runCheck(): Promise<void> {
  setButton(null, true);
  setStatus('app.update.checking');
  const check = await checkForUpdate(latestSource(location.origin), installedVersion());
  showResult(check);
}

/**
 * Puts a version in the phone's known-good copy: every file fetched and
 * checked against the manifest, then handed to the service worker.
 */
async function installVersion(manifest: ReleaseManifest): Promise<string> {
  const paths = Object.keys(manifest.files);
  const { files, rejected } = await fetchVerifiedFiles(manifest, paths, location.origin);
  if (rejected.length > 0) throw new Error(t('app.update.badFile'));

  // The worker is code too, so it is checked before it is registered.
  const workerBytes = new Uint8Array(
    await (await fetch('/app-sw.js', { cache: 'no-store' })).arrayBuffer(),
  );
  if (!(await fileMatches(manifest, '/app-sw.js', workerBytes))) {
    throw new Error(t('app.update.badWorker'));
  }

  let worker: ServiceWorker | null = null;
  for (const scope of SCOPES) {
    const registration = await navigator.serviceWorker.register('/app-sw.js', { scope });
    worker = registration.active ?? registration.waiting ?? registration.installing;
  }
  if (!worker) throw new Error(t('app.update.noWorker'));

  const payload = [...files.entries()].map(([path, bytes]) => ({
    url: path,
    body: bytes,
    contentType: path.endsWith('.html')
      ? 'text/html; charset=utf-8'
      : path.endsWith('.css')
        ? 'text/css; charset=utf-8'
        : 'application/javascript; charset=utf-8',
  }));

  await messageWorker(worker, { type: 'cache-files', version: manifest.version, files: payload });
  return manifest.version;
}

/** Sends a message to the worker and waits for its answer. */
function messageWorker(worker: ServiceWorker, message: unknown): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('the service worker did not answer')), 20_000);
    const onMessage = (event: MessageEvent) => {
      if (event.data?.type === 'error') {
        clearTimeout(timer);
        navigator.serviceWorker.removeEventListener('message', onMessage);
        reject(new Error(event.data.reason ?? 'the service worker refused'));
        return;
      }
      clearTimeout(timer);
      navigator.serviceWorker.removeEventListener('message', onMessage);
      resolve(event.data);
    };
    navigator.serviceWorker.addEventListener('message', onMessage);
    worker.postMessage(message);
  });
}

/**
 * Makes the copy of the version that is running. It happens in the
 * background: the app works with or without it, and a member never waits
 * for it.
 */
async function seedKnownGoodCopy(): Promise<void> {
  if (!('serviceWorker' in navigator)) return;
  const version = installedVersion();
  // The release has to be signed and in the log, or no copy is made.
  const checked = await verifyRelease(version, location.origin);
  if ('error' in checked) return;
  try {
    const installed = await installVersion(checked.manifest);
    const registration = await navigator.serviceWorker.ready;
    const worker = registration.active;
    if (worker) await messageWorker(worker, { type: 'activate', version: installed });
  } catch {
    // The app still works from the network. Nothing to say to the member.
  }
}

async function install(): Promise<void> {
  const button = el<HTMLButtonElement>('[data-update-install]');
  if (button) button.disabled = true;
  setStatus('app.update.installing');
  try {
    // The version the check found, checked again from scratch.
    const check = await checkForUpdate(latestSource(location.origin), installedVersion());
    if (check.state !== 'available' || !check.latest) {
      throw new Error(t('app.update.badManifest'));
    }
    const checked = await verifyRelease(check.latest, location.origin);
    if ('error' in checked) throw new Error(checked.error);

    const version = await installVersion(checked.manifest);
    const registration = await navigator.serviceWorker.ready;
    const worker = registration.active;
    if (worker) await messageWorker(worker, { type: 'activate', version });

    setStatus('app.update.done');
    // The new version takes over on the next load.
    setTimeout(() => location.reload(), 800);
  } catch (error) {
    if (button) button.disabled = false;
    setStatus('app.update.failed', error instanceof Error ? error.message : '');
  }
}

function start(): void {
  const version = el<HTMLElement>('[data-update-current]');
  if (version) version.textContent = installedVersion();

  el<HTMLButtonElement>('[data-update-check]')?.addEventListener('click', () => {
    void runCheck();
  });
  el<HTMLButtonElement>('[data-update-install]')?.addEventListener('click', () => {
    void install();
  });

  void seedKnownGoodCopy();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', start);
} else {
  start();
}

// The version is compiled in, so a mismatch here means the bundle is not
// the one this screen was written for.
if (APP_VERSION !== installedVersion()) {
  console.warn('the app version and the bundle do not match');
}
