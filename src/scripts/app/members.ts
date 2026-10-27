/**
 * Screen 10: Members and keys.
 *
 * The roster, the one-time invites, the two-person removal, and the
 * recovery shares. Everything here runs on the device: the server never
 * sees a member list.
 */
import { appCatalogs, type AppStringKey } from '../../i18n/app';
import {
  onDocChange,
  isSyncOff,
  readSyncServer,
  sessionVault,
  syncServerDisplay,
  writeSyncServer,
  type Session,
} from '../../lib/workspace/app-state';
import {
  approveInvite,
  computeCheckCode,
  createInvite,
  formatCheckCode,
  inviteFragment,
  listInvites,
  revokeInvite,
  saveInvite,
  verifyJoinRequest,
  type InviteRecord,
  type JoinRequest,
  type Tier,
} from '../../lib/workspace/invite';
import { generateDeviceKeyPair, toBase64Url } from '../../lib/workspace/keys';
import { memberList, removeMember, setMember, type MemberRecord } from '../../lib/workspace/model';
import {
  createRecoveryBundle,
  encodeShareForRoom,
  recoverRoomKeyForRoom,
} from '../../lib/workspace/recovery';
import {
  makeRemovalAuthorization,
  planRemoval,
  RemovalError,
  removalAuthPayload,
} from '../../lib/workspace/removal';
import { el, lang, withSession } from './shared';
import { onSyncStatus, startSync, stopSync, syncStatus } from './sync-client';
import type * as Y from 'yjs';

const t = (key: AppStringKey): string => appCatalogs[lang()][key];

let session: Session | null = null;
let doc: Y.Doc | null = null;
let devicePublicRaw: Uint8Array | null = null;
let devicePrivateKey: CryptoKey | null = null;
/** The request being checked, and the invite it came with. */
let pendingRequest: { invite: InviteRecord; request: JoinRequest } | null = null;

function roleKey(role: MemberRecord['role']): AppStringKey {
  return `app.members.role.${role}` as AppStringKey;
}

function renderRoster(): void {
  const container = el<HTMLElement>('[data-members-roster]');
  if (!container || !doc) return;
  const members = memberList(doc);
  if (members.length === 0) {
    const note = document.createElement('p');
    note.className = 'state__body';
    note.textContent = t('app.members.none');
    container.replaceChildren(note);
    return;
  }
  const list = document.createElement('ul');
  list.className = 'dot-list';
  for (const member of members) {
    const item = document.createElement('li');
    item.className = 'dot-list__row';
    const name = document.createElement('span');
    name.className = 'dot-list__name';
    name.textContent = member.name;
    const meta = document.createElement('span');
    meta.className = 'dot-list__meta';
    meta.textContent = `${t(roleKey(member.role))} · ${t('app.members.devices').replace('{count}', String(member.devices))}`;
    item.append(name, meta);
    list.append(item);
  }
  container.replaceChildren(list);
}

async function renderPending(): Promise<void> {
  const container = el<HTMLElement>('[data-invite-pending]');
  if (!container) return;
  let records: InviteRecord[] = [];
  try {
    records = await listInvites(sessionVault());
  } catch {
    records = [];
  }
  const pending = records.filter((record) => record.state === 'pending');
  if (pending.length === 0) {
    const note = document.createElement('p');
    note.className = 'state__body';
    note.textContent = t('app.members.none');
    container.replaceChildren(note);
    return;
  }
  const list = document.createElement('ul');
  list.className = 'dot-list';
  for (const record of pending) {
    const item = document.createElement('li');
    item.className = 'dot-list__row';
    const when = document.createElement('span');
    when.className = 'dot-list__name';
    when.textContent = t('app.members.expires').replace(
      '{date}',
      new Date(record.expiresAt).toISOString().slice(0, 10),
    );
    const revoke = document.createElement('button');
    revoke.className = 'button button--danger';
    revoke.type = 'button';
    revoke.textContent = t('app.members.deny');
    revoke.addEventListener('click', async () => {
      await revokeInvite(sessionVault(), record.id);
      await renderPending();
    });
    item.append(when, revoke);
    list.append(item);
  }
  container.replaceChildren(list);
}

async function makeInvite(): Promise<void> {
  const container = el<HTMLElement>('[data-invite-output]');
  if (!container || !session) return;
  const tier = (el<HTMLSelectElement>('[data-invite-tier]')?.value ?? 'committee') as Tier;
  if (!devicePublicRaw) {
    const pair = await generateDeviceKeyPair();
    devicePublicRaw = pair.publicRaw;
  }
  const record = createInvite({
    roomId: session.roomId,
    tier,
    inviterPublicRaw: devicePublicRaw,
  });
  await saveInvite(sessionVault(), record);
  const link = `${location.origin}/app/join#${inviteFragment(record)}`;

  const box = document.createElement('div');
  box.className = 'well';
  const label = document.createElement('p');
  label.className = 'well__title';
  label.textContent = t('app.members.link');
  const field = document.createElement('input');
  field.className = 'field__input';
  field.type = 'text';
  field.readOnly = true;
  field.value = link;
  const copy = document.createElement('button');
  copy.className = 'button button--block';
  copy.type = 'button';
  copy.textContent = t('app.members.copy');
  copy.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(link);
      copy.textContent = t('app.members.copied');
    } catch {
      field.select();
    }
  });
  const hint = document.createElement('p');
  hint.className = 'well__body';
  hint.textContent = t('app.members.linkHint');
  box.append(label, field, copy, hint);
  container.replaceChildren(box);
  await renderPending();
}

function renderRemoveForm(): void {
  const container = el<HTMLElement>('[data-remove-form]');
  if (!container || !doc || !session) return;
  const target = memberList(doc).find((member) => member.id !== session!.memberId && member.role !== 'core') ?? null;
  const box = document.createElement('div');
  box.className = 'well';

  const warn = document.createElement('p');
  warn.className = 'well__body';
  warn.textContent = t('app.members.warn');
  box.append(warn);

  if (!target) {
    const note = document.createElement('p');
    note.className = 'state__body';
    note.textContent = t('app.members.removeNone');
    box.append(note);
    container.replaceChildren(box);
    return;
  }

  // The request this device asks another core member to authorize. The
  // second member opens the app on their own phone, pastes this in from the
  // Members and keys screen, and hands back the authorization code.
  const requestLabel = document.createElement('p');
  requestLabel.className = 'well__title';
  requestLabel.textContent = t('app.members.removeRequest');
  const request = document.createElement('textarea');
  request.className = 'field__textarea';
  request.readOnly = true;
  request.rows = 2;
  request.value = JSON.stringify({ memberId: target.id, roomId: session.roomId, name: target.name });
  const copyRequest = document.createElement('button');
  copyRequest.className = 'button button--block';
  copyRequest.type = 'button';
  copyRequest.textContent = t('app.members.copy');
  copyRequest.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(request.value);
      copyRequest.textContent = t('app.members.copied');
    } catch {
      request.select();
    }
  });

  const authLabel = document.createElement('p');
  authLabel.className = 'well__title';
  authLabel.textContent = t('app.members.removeAuth');
  const auth = document.createElement('textarea');
  auth.className = 'field__textarea';
  auth.placeholder = t('app.members.removeAuthHint');
  auth.rows = 2;
  const remove = document.createElement('button');
  remove.className = 'button button--danger button--block';
  remove.type = 'button';
  remove.textContent = t('app.members.remove');
  remove.addEventListener('click', () => {
    void runRemoval(target.id, auth.value);
  });

  box.append(requestLabel, request, copyRequest, authLabel, auth, remove);
  container.replaceChildren(box);
}

/**
 * The other side of removal: a core member pastes in the removal request
 * they were sent and this device makes the authorization for it.
 */
function renderAuthorizeForm(): void {
  const container = el<HTMLElement>('[data-authorize-form]');
  if (!container || !session || !doc) return;
  const box = document.createElement('div');
  box.className = 'well';

  const label = document.createElement('p');
  label.className = 'well__title';
  label.textContent = t('app.members.authorizeTitle');
  const hint = document.createElement('p');
  hint.className = 'well__body';
  hint.textContent = t('app.members.authorizeLine');
  const input = document.createElement('textarea');
  input.className = 'field__textarea';
  input.placeholder = t('app.members.authorizePaste');
  input.rows = 3;
  const make = document.createElement('button');
  make.className = 'button button--primary button--block';
  make.type = 'button';
  make.textContent = t('app.members.authorizeMake');
  make.addEventListener('click', () => {
    if (!session) throw new Error('no session on the authorize screen');
    void (async () => {
      const request = JSON.parse(input.value) as { memberId?: string; roomId?: string };
      if (request.roomId !== session.roomId || !request.memberId) {
        throw new Error('not a request for this room');
      }
      const code = await makeRemovalAuthorization(session.roomKey, request.memberId, session.roomId);
      const out = document.createElement('textarea');
      out.className = 'field__textarea';
      out.readOnly = true;
      out.rows = 2;
      out.value = code;
      const copy = document.createElement('button');
      copy.className = 'button button--block';
      copy.type = 'button';
      copy.textContent = t('app.members.copyAnswer');
      copy.addEventListener('click', async () => {
        try {
          await navigator.clipboard.writeText(out.value);
          copy.textContent = t('app.members.copied');
        } catch {
          out.select();
        }
      });
      box.replaceChildren(label, hint, input, make, out, copy);
    })().catch(() => {
      const bad = document.createElement('p');
      bad.className = 'field__error';
      bad.textContent = t('app.members.badRequest');
      box.prepend(bad);
    });
  });
  box.append(label, hint, input, make);
  container.replaceChildren(box);
}

async function runRemoval(memberId: string, authorization: string): Promise<void> {
  const container = el<HTMLElement>('[data-remove-form]');
  if (!container || !session || !doc) return;
  const target = memberList(doc).find((member) => member.id === memberId);
  if (!target) return;
  try {
    const plan = await planRemoval({
      workspace: {
        coreRoomId: session.roomId,
        rooms: [
          {
            id: session.roomId,
            tier: 'core',
            parentId: null,
            memberIds: memberList(doc).map((member) => member.id),
          },
        ],
      },
      memberId: target.id,
      actorId: session.memberId,
      authorizations: authorization ? [authorization] : [],
      roomKeys: [{ roomId: session.roomId, key: session.roomKey }],
    });
    removeMember(doc, target.id);
    await session.save();
    renderRoster();
    renderRemoveForm();
    renderAuthorizeForm();
    // The status lands after the re-renders, so it is not wiped by them.
    const note = document.createElement('p');
    note.className = 'well__body';
    note.textContent = t('app.members.removed').replace('{name}', target.name);
    const warn = document.createElement('p');
    warn.className = 'field__hint';
    warn.textContent = plan.notice;
    container.prepend(note, warn);
  } catch (error) {
    const note = document.createElement('p');
    note.className = 'field__error';
    if (error instanceof RemovalError) note.textContent = t('app.members.removeNeedsAuth');
    else note.textContent = error instanceof Error ? error.message : String(error);
    container.prepend(note);
  }
}

function renderRecoveryForm(): void {
  const container = el<HTMLElement>('[data-recovery-form]');
  if (!container || !doc) return;
  const core = memberList(doc).filter((member) => member.role === 'core');
  const box = document.createElement('div');
  box.className = 'well';
  if (core.length < 3) {
    const note = document.createElement('p');
    note.className = 'state__body';
    note.textContent = t('app.members.recoveryNeedsThree');
    box.append(note);
    container.replaceChildren(box);
    return;
  }

  const makeSection = document.createElement('div');
  const make = document.createElement('button');
  make.className = 'button button--block';
  make.type = 'button';
  make.textContent = t('app.members.recoveryMake');
  make.addEventListener('click', () => {
    // The session is there: this screen only renders with one.
    if (!session) throw new Error('no session on the recovery screen');
    const bundle = createRecoveryBundle(
      session.roomId,
      session.roomKey,
      core.slice(0, 3).map((member) => member.id),
    );
    const list = document.createElement('div');
    for (const holder of bundle.holders) {
      const label = document.createElement('p');
      label.className = 'well__title';
      label.textContent = t('app.members.share')
        .replace('{index}', String(holder.share.index))
        .replace('{name}', holder.holderId);
      const field = document.createElement('input');
      field.className = 'field__input';
      field.type = 'text';
      field.readOnly = true;
      void encodeShareForRoom(holder.share, session.roomId).then((coded) => {
        field.value = coded;
      });
      list.append(label, field);
    }
    // Only the share list is replaced. The rebuild block below stays, so
    // the member can paste two shares straight away.
    makeSection.replaceChildren(list, make);
  });
  makeSection.append(make);

  const rebuildLabel = document.createElement('p');
  rebuildLabel.className = 'well__title';
  rebuildLabel.textContent = t('app.members.recoveryRebuild');
  const first = document.createElement('textarea');
  first.className = 'field__textarea';
  first.placeholder = t('app.members.share').replace('{index}', '1').replace('{name}', '');
  const second = document.createElement('textarea');
  second.className = 'field__textarea';
  second.placeholder = t('app.members.share').replace('{index}', '2').replace('{name}', '');
  const rebuild = document.createElement('button');
  rebuild.className = 'button button--primary button--block';
  rebuild.type = 'button';
  rebuild.textContent = t('app.members.recoveryRebuild');
  rebuild.addEventListener('click', () => {
    const open = session;
    if (!open) throw new Error('no session on the recovery screen');
    const done = async () => {
      const key = await recoverRoomKeyForRoom(
        open.roomId,
        [first.value, second.value],
      );
      // A key that does not belong to this room is refused by the share
      // MACs; the members screen shows what happened either way.
      open.roomKey = key;
      await open.save();
      const note = document.createElement('p');
      note.className = 'stamp stamp--ok';
      note.textContent = t('app.members.recoveryRebuilt');
      box.prepend(note);
    };
    void done().catch(() => {
      const note = document.createElement('p');
      note.className = 'field__error';
      note.textContent = t('app.members.recoveryFailed');
      box.prepend(note);
    });
  });

  box.append(makeSection, rebuildLabel, first, second, rebuild);
  container.replaceChildren(box);
}

el<HTMLFormElement>('[data-member-form]')?.addEventListener('submit', async (event) => {
  event.preventDefault();
  if (!session || !doc) return;
  const form = event.currentTarget as HTMLFormElement;
  const data = new FormData(form);
  const name = String(data.get('name') ?? '').trim();
  const role = String(data.get('role') ?? 'committee') as MemberRecord['role'];
  if (!name) return;
  // Clear the form before the save, so a member typing during the save
  // does not lose what they wrote.
  form.reset();
  setMember(doc, {
    id: `m-${toBase64Url(crypto.getRandomValues(new Uint8Array(6)))}`,
    name,
    role,
    devices: 1,
  });
  await session.save();
  renderRoster();
  renderRemoveForm();
  renderRecoveryForm();
});

el<HTMLButtonElement>('[data-invite-make]')?.addEventListener('click', () => {
  void makeInvite();
});

function renderSyncStatus(): void {
  const box = el<HTMLElement>('[data-sync-status]');
  if (!box) return;
  const status = syncStatus();
  if (isSyncOff()) {
    box.textContent = t('app.sync.off');
    return;
  }
  if (!status) {
    box.textContent = t('app.sync.off');
    return;
  }
  if (status.connected) {
    box.textContent = t('app.sync.on').replace('{url}', readSyncServer() || location.origin);
    return;
  }
  box.textContent = t('app.sync.problem').replace('{problem}', status.problem ?? '');
}

el<HTMLButtonElement>('[data-sync-save]')?.addEventListener('click', async () => {
  const input = el<HTMLInputElement>('[data-sync-server]');
  if (!input) return;
  const url = writeSyncServer(input.value);
  stopSync();
  if (!isSyncOff()) await startSync();
  const box = el<HTMLElement>('[data-sync-status]');
  if (box) box.textContent = isSyncOff() ? t('app.sync.off') : t('app.sync.saved');
  renderSyncStatus();
});

onSyncStatus(() => renderSyncStatus());

el<HTMLButtonElement>('[data-request-check]')?.addEventListener('click', async () => {
  const input = el<HTMLTextAreaElement>('[data-request-input]');
  const error = el<HTMLElement>('[data-request-error]');
  const codeBox = el<HTMLElement>('[data-check-code]');
  if (!input || !devicePrivateKey || !devicePublicRaw) return;
  try {
    const request = JSON.parse(input.value) as JoinRequest;
    const records = await listInvites(sessionVault());
    const invite = records.find((record) => record.id === request.inviteId);
    if (!invite) throw new Error('not-found');
    const verified = await verifyJoinRequest(
      {
        id: invite.id,
        inviterPublicB64: invite.inviterPublicB64,
        secretB64: invite.secretB64,
      },
      devicePrivateKey,
      request,
    );
    const code = await computeCheckCode(
      verified.shared,
      invite.id,
      devicePublicRaw,
      verified.devicePublicRaw,
    );
    pendingRequest = { invite, request };
    const value = el<HTMLElement>('[data-check-code-value]');
    if (value) value.textContent = formatCheckCode(code, lang());
    if (codeBox) codeBox.hidden = false;
    if (error) error.hidden = true;
  } catch {
    pendingRequest = null;
    if (codeBox) codeBox.hidden = true;
    if (error) {
      error.hidden = false;
      error.textContent = t('app.members.badRequest');
    }
  }
});

el<HTMLButtonElement>('[data-request-approve]')?.addEventListener('click', async () => {
  const confirmed = el<HTMLInputElement>('[data-check-confirmed]')?.checked;
  if (!pendingRequest || !confirmed || !devicePrivateKey || !session) return;
  try {
    const response = await approveInvite({
      vault: sessionVault(),
      inviteId: pendingRequest.invite.id,
      inviterPrivateKey: devicePrivateKey,
      request: pendingRequest.request,
      roomKey: session.roomKey,
      checkCodeConfirmed: true,
    });
    const answer = el<HTMLElement>('[data-answer]');
    const text = el<HTMLTextAreaElement>('[data-answer-text]');
    if (answer) answer.hidden = false;
    if (text) text.value = JSON.stringify(response);
    pendingRequest = null;
    await renderPending();
  } catch {
    const error = el<HTMLElement>('[data-request-error]');
    if (error) {
      error.hidden = false;
      error.textContent = t('app.members.badRequest');
    }
  }
});

el<HTMLButtonElement>('[data-answer-copy]')?.addEventListener('click', async () => {
  const text = el<HTMLTextAreaElement>('[data-answer-text]');
  if (!text) return;
  try {
    await navigator.clipboard.writeText(text.value);
  } catch {
    text.select();
  }
});

withSession(async (open) => {
  session = open;
  doc = open.doc;
  const pair = await generateDeviceKeyPair();
  devicePublicRaw = pair.publicRaw;
  devicePrivateKey = pair.privateKey;
  const serverInput = el<HTMLInputElement>('[data-sync-server]');
  if (serverInput) serverInput.value = syncServerDisplay();
  renderRoster();
  renderRemoveForm();
  renderAuthorizeForm();
  renderRecoveryForm();
  await renderPending();
  renderSyncStatus();
  onDocChange(doc, renderRoster);
});
