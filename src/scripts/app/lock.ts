/**
 * Screen 0: Lock.
 *
 * The chrome carries no union vocabulary. The name on the screen is whatever
 * the member chose, so a work phone shows "Notes" in the tab.
 */
import {
  createWorkspace,
  hasWorkspace,
  readSettings,
  unlockWorkspace,
  wipeDevice,
  writeSettings,
} from '../../lib/workspace/app-state';
import { addConversation, setRating, upsertCoworker } from '../../lib/workspace/model';
import { appCatalogs, type AppStringKey } from '../../i18n/app';
import { all, el, lang } from './shared';

const t = (key: AppStringKey): string => appCatalogs[lang()][key];

function setState(name: 'loading' | 'ready' | 'error', message?: string): void {
  const loading = el<HTMLElement>('[data-lock-state]');
  const form = el<HTMLFormElement>('[data-lock-form]');
  const error = el<HTMLElement>('[data-lock-error]');
  if (loading) loading.hidden = name !== 'loading';
  if (form) form.hidden = name === 'loading';
  if (error) {
    error.hidden = !message;
    error.textContent = message ?? '';
  }
}

function applyDisguise(): void {
  const settings = readSettings();
  for (const node of all<HTMLElement>('[data-screen-name]')) {
    node.textContent = settings.screenName;
  }
  document.title = settings.screenName;
  const input = el<HTMLInputElement>('#screen-name');
  if (input && document.activeElement !== input) input.value = settings.screenName;
  const disguise = el<HTMLElement>('[data-lock-disguise]');
  if (disguise) disguise.hidden = false;
}

async function start(): Promise<void> {
  const exists = await hasWorkspace();
  const form = el<HTMLFormElement>('[data-lock-form]');
  const heading = el<HTMLElement>('[data-lock-heading]');
  const confirmField = el<HTMLElement>('[data-lock-confirm-field]');
  const nameField = el<HTMLElement>('[data-lock-name-field]');
  const submit = el<HTMLButtonElement>('[data-lock-submit]');
  const sample = el<HTMLButtonElement>('[data-lock-sample]');
  const empty = el<HTMLElement>('[data-lock-empty]');
  const wipe = el<HTMLButtonElement>('[data-lock-wipe]');

  if (heading) heading.textContent = exists ? t('app.lock.unlockTitle') : t('app.lock.createTitle');
  if (submit) submit.textContent = exists ? t('app.lock.unlock') : t('app.lock.create');
  if (confirmField) confirmField.hidden = exists;
  if (nameField) nameField.hidden = exists;
  if (sample) sample.hidden = exists;
  if (empty) empty.hidden = exists;
  // There is nothing to erase on a device that holds nothing.
  if (wipe) wipe.hidden = !exists;
  setState('ready');
}

el<HTMLFormElement>('[data-lock-form]')?.addEventListener('submit', async (event) => {
  event.preventDefault();
  const form = event.currentTarget as HTMLFormElement;
  const data = new FormData(form);
  const passphrase = String(data.get('passphrase') ?? '');
  const confirm = String(data.get('confirm') ?? '');
  const name = String(data.get('name') ?? '');
  const submit = el<HTMLButtonElement>('[data-lock-submit]');

  if (passphrase.length < 12) {
    setState('error', t('app.lock.passphraseHint'));
    return;
  }
  if (confirm && confirm !== passphrase) {
    setState('error', t('app.lock.wrong'));
    return;
  }
  submit?.setAttribute('aria-disabled', 'true');
  setState('loading');
  try {
    const exists = await hasWorkspace();
    if (exists) {
      await unlockWorkspace(passphrase);
    } else {
      await createWorkspace(passphrase, { name });
    }
    location.replace(lang() === 'es' ? '/es/app/today' : '/app/today');
  } catch {
    setState('error', t('app.lock.wrong'));
    submit?.removeAttribute('aria-disabled');
  }
});

/** A sample drive, so people can try the app before they type their own list. */
el<HTMLButtonElement>('[data-lock-sample]')?.addEventListener('click', async () => {
  const passphrase = 'sample drive passphrase';
  const session = await createWorkspace(passphrase);
  upsertCoworker(session.doc, {
    id: 'sample-rosa',
    displayName: 'Rosa',
    dept: 'Dairy',
    shift: 'Nights',
    language: 'es',
  });
  upsertCoworker(session.doc, {
    id: 'sample-ana',
    displayName: 'Ana',
    dept: 'Dairy',
    shift: 'Nights',
    language: 'es',
  });
  upsertCoworker(session.doc, {
    id: 'sample-ben',
    displayName: 'Ben',
    dept: 'Packaging',
    shift: 'Days',
    language: 'en',
  });
  setRating(session.doc, 'sample-rosa', 2, new Date().toISOString(), session.memberId);
  setRating(session.doc, 'sample-ana', 3, new Date().toISOString(), session.memberId);
  addConversation(session.doc, {
    id: 'sample-cv1',
    coworker: 'sample-rosa',
    by: session.memberId,
    at: new Date().toISOString(),
    from: 3,
    to: 2,
    issues: ['schedule'],
  });
  await session.save();
  location.replace(lang() === 'es' ? '/es/app/today' : '/app/today');
});

el<HTMLButtonElement>('[data-lock-wipe]')?.addEventListener('click', async () => {
  if (!confirm(t('app.lock.wipeConfirm'))) return;
  await wipeDevice();
  await start();
});

el<HTMLInputElement>('#screen-name')?.addEventListener('change', (event) => {
  const input = event.currentTarget as HTMLInputElement;
  const value = input.value.trim() || t('app.disguise');
  writeSettings({ screenName: value });
  applyDisguise();
});

applyDisguise();
start();
