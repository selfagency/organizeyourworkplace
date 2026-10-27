/**
 * The invitee side of the join.
 *
 * The link carries the secret in the fragment, which never reaches a
 * server. The app takes the fragment out of the address bar right away,
 * makes a join request, and waits for the core member's answer.
 */
import { appCatalogs, type AppStringKey } from '../../i18n/app';
import { createWorkspace, setRoomKey, type Session } from '../../lib/workspace/app-state';
import {
  acceptKeyResponse,
  buildJoinRequest,
  parseInviteFragment,
  stripFragmentFromUrl,
  type KeyResponse,
  type ParsedInvite,
} from '../../lib/workspace/invite';
import { generateDeviceKeyPair, toBase64Url } from '../../lib/workspace/keys';
import { el, lang } from './shared';

const t = (key: AppStringKey): string => appCatalogs[lang()][key];

let invite: ParsedInvite | null = null;
let devicePrivateKey: CryptoKey | null = null;
let session: Session | null = null;

function showError(message: string): void {
  const error = el<HTMLElement>('[data-join-error]');
  if (!error) return;
  error.hidden = false;
  error.textContent = message;
}

function start(): void {
  const fragment = location.hash.replace(/^#/, '');
  if (!fragment) {
    const state = el<HTMLElement>('[data-join-state]');
    if (state) {
      const title = state.querySelector('.state__title');
      const body = state.querySelector('.state__body');
      if (title) title.textContent = t('app.join.waiting');
      if (body) body.textContent = t('app.join.waitingBody');
    }
    return;
  }
  try {
    invite = parseInviteFragment(fragment);
  } catch {
    showError(t('app.lock.wrong'));
    return;
  }
  // The secret is in the address bar until now. Take it out.
  history.replaceState(null, '', stripFragmentFromUrl(location.href, history));
  const state = el<HTMLElement>('[data-join-state]');
  if (state) state.hidden = true;
  const form = el<HTMLElement>('[data-join-passphrase]');
  if (form) form.hidden = false;
}

el<HTMLFormElement>('[data-join-passphrase]')?.addEventListener('submit', async (event) => {
  event.preventDefault();
  const form = event.currentTarget as HTMLFormElement;
  const data = new FormData(form);
  const passphrase = String(data.get('passphrase') ?? '');
  const confirm = String(data.get('confirm') ?? '');
  if (passphrase.length < 12 || passphrase !== confirm) {
    showError(t('app.lock.wrong'));
    return;
  }
  try {
    const pair = await generateDeviceKeyPair();
    devicePrivateKey = pair.privateKey;
    session = await createWorkspace(passphrase);
    const request = await buildJoinRequest(invite!, pair.publicRaw);
    const section = el<HTMLElement>('[data-join-request]');
    const text = el<HTMLTextAreaElement>('[data-join-request-text]');
    if (section) section.hidden = false;
    if (text) text.value = JSON.stringify(request);
    form.hidden = true;
  } catch {
    showError(t('app.lock.wrong'));
  }
});

el<HTMLButtonElement>('[data-join-copy-request]')?.addEventListener('click', async () => {
  const text = el<HTMLTextAreaElement>('[data-join-request-text]');
  if (!text) return;
  try {
    await navigator.clipboard.writeText(text.value);
  } catch {
    text.select();
  }
});

el<HTMLButtonElement>('[data-join-open]')?.addEventListener('click', async () => {
  if (!invite || !devicePrivateKey || !session) return;
  const text = el<HTMLTextAreaElement>('[data-join-response-text]');
  try {
    const response = JSON.parse(text?.value ?? '{}') as KeyResponse;
    const roomKey = await acceptKeyResponse(invite, devicePrivateKey, response);
    await setRoomKey(session, roomKey);
    location.replace(lang() === 'es' ? '/es/app/today' : '/app/today');
  } catch {
    showError(t('app.lock.wrong'));
  }
});

start();
const responseSection = el<HTMLElement>('[data-join-response]');
if (responseSection) responseSection.hidden = false;

// Someone who is already on this page and pastes an invite link should
// not have to reload.
window.addEventListener('hashchange', () => {
  if (location.hash) start();
});
