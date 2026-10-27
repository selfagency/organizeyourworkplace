/**
 * Screen 10: Members and keys.
 *
 * The roster, the one-time invites, the two-person removal, and the
 * recovery shares. Everything here runs on the device: the server never
 * sees a member list.
 */
import { appCatalogs, type AppStringKey } from '../../i18n/app';
import {
  createWorkspace,
  onDocChange,
  readSyncServer,
  sessionVault,
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
import { fromBase64Url, generateDeviceKeyPair, toBase64Url } from '../../lib/workspace/keys';
import { memberList, removeMember, setMember, type MemberRecord } from '../../lib/workspace/model';
import { createRecoveryBundle, decodeShare, encodeShare, recoverRoomKey } from '../../lib/workspace/recovery';
import { planRemoval } from '../../lib/workspace/removal';
import { el, lang, withSession } from './shared';
import { onSyncStatus, startSync, stopSync, syncStatus } from './sync-client';
import type * as Y from 'yjs';

const t = (key: AppStringKey): string => appCatalogs[lang()][key];

let session: Session | null = null;
let doc: Y.Doc | null = null;
let devicePublicRaw: Uint8Array | null = null;
let devicePrivateKey: CryptoKey | null = null;
const removeApprovals = new Set<string>();
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
  if (!container || !doc) return;
  const core = memberList(doc).filter((member) => member.role === 'core');
  if (core.length === 0) {
    const note = document.createElement('p');
    note.className = 'state__body';
    note.textContent = t('app.members.removeNeedsTwo');
    container.replaceChildren(note);
    return;
  }
  const box = document.createElement('div');
  box.className = 'well';
  const heading = document.createElement('p');
  heading.className = 'well__title';
  heading.textContent = t('app.handoff.approvals');
  const list = document.createElement('ul');
  list.className = 'dot-list';
  for (const member of core) {
    const item = document.createElement('li');
    const label = document.createElement('label');
    label.className = 'dot-list__row';
    const box2 = document.createElement('input');
    box2.type = 'checkbox';
    box2.checked = removeApprovals.has(member.id);
    box2.addEventListener('change', () => {
      if (box2.checked) removeApprovals.add(member.id);
      else removeApprovals.delete(member.id);
    });
    const name = document.createElement('span');
    name.className = 'dot-list__name';
    name.textContent = member.name;
    label.append(box2, name);
    item.append(label);
    list.append(item);
  }
  const button = document.createElement('button');
  button.className = 'button button--danger button--block';
  button.type = 'button';
  button.textContent = t('app.members.remove');
  button.addEventListener('click', () => {
    void runRemoval();
  });
  box.append(heading, list, button);
  container.replaceChildren(box);
}

async function runRemoval(): Promise<void> {
  const container = el<HTMLElement>('[data-remove-form]');
  if (!container || !session || !doc) return;
  if (removeApprovals.size < 2) {
    const note = document.createElement('p');
    note.className = 'field__error';
    note.textContent = t('app.members.removeNeedsTwo');
    container.prepend(note);
    return;
  }
  const target = memberList(doc).find((member) => member.role !== 'core') ?? null;
  if (!target) {
    const note = document.createElement('p');
    note.className = 'field__error';
    note.textContent = t('app.members.none');
    container.prepend(note);
    return;
  }
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
      approvals: [...removeApprovals],
      roomKeys: [{ roomId: session.roomId, key: session.roomKey }],
    });
    removeMember(doc, target.id);
    await session.save();
    const note = document.createElement('p');
    note.className = 'well__body';
    note.textContent = t('app.members.removed').replace('{name}', target.name);
    const warn = document.createElement('p');
    warn.className = 'field__hint';
    warn.textContent = plan.notice;
    container.prepend(note, warn);
    renderRoster();
    renderRemoveForm();
  } catch (error) {
    const note = document.createElement('p');
    note.className = 'field__error';
    note.textContent = error instanceof Error ? error.message : String(error);
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

  const make = document.createElement('button');
  make.className = 'button button--block';
  make.type = 'button';
  make.textContent = t('app.members.recoveryMake');
  make.addEventListener('click', () => {
    const bundle = createRecoveryBundle(
      session?.roomId ?? 'room',
      session?.roomKey ?? new Uint8Array(32),
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
      field.value = toBase64Url(encodeShare(holder.share));
      list.append(label, field);
    }
    box.replaceChildren(list, make);
  });

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
    if (!session) return;
    try {
      const shares = [first.value, second.value]
        .filter((value) => value.trim())
        .map((value) => decodeShare(fromBase64Url(value.trim())));
      const key = recoverRoomKey({ roomId: session.roomId, holders: [], threshold: 2 }, shares);
      session.roomKey = key;
      void session.save();
      const note = document.createElement('p');
      note.className = 'stamp stamp--ok';
      note.textContent = t('app.members.recoveryRebuild');
      box.prepend(note);
    } catch {
      const note = document.createElement('p');
      note.className = 'field__error';
      note.textContent = t('app.lock.wrong');
      box.prepend(note);
    }
  });

  box.append(make, rebuildLabel, first, second, rebuild);
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
  if (!status) {
    box.textContent = readSyncServer() ? t('app.sync.off') : t('app.sync.off');
    return;
  }
  if (status.connected) {
    box.textContent = t('app.sync.on').replace('{url}', readSyncServer());
    return;
  }
  box.textContent = t('app.sync.problem').replace('{problem}', status.problem ?? '');
}

el<HTMLButtonElement>('[data-sync-save]')?.addEventListener('click', async () => {
  const input = el<HTMLInputElement>('[data-sync-server]');
  if (!input) return;
  const url = writeSyncServer(input.value);
  stopSync();
  if (url) await startSync();
  const box = el<HTMLElement>('[data-sync-status]');
  if (box) box.textContent = url ? t('app.sync.saved') : t('app.sync.off');
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
  if (serverInput) serverInput.value = readSyncServer();
  renderRoster();
  renderRemoveForm();
  renderRecoveryForm();
  await renderPending();
  renderSyncStatus();
  onDocChange(doc, renderRoster);
});
