import { describe, expect, it } from 'vitest';

import { deriveKey } from './crypto';
import { generateDeviceKeyPair, fromBase64Url, toBase64Url } from './keys';
import { createMemoryStore } from './storage';
import {
  approveInvite,
  acceptKeyResponse,
  buildJoinRequest,
  computeCheckCode,
  createInvite,
  formatCheckCode,
  inviteeSharedSecret,
  inviteFragment,
  InviteError,
  INVITE_TTL_MS,
  listInvites,
  loadInvite,
  parseInviteFragment,
  revokeInvite,
  saveInvite,
  stripFragmentFromUrl,
  verifyJoinRequest,
  type InviteVault,
  type ParsedInvite,
} from './invite';
import { CHECK_WORDS } from './wordlist';

const NOW = Date.UTC(2026, 9, 27, 12, 0, 0);

const vaultKey = deriveKey('committee-passphrase', new Uint8Array(16).fill(3));

async function makeVault(): Promise<InviteVault> {
  return { store: createMemoryStore(), key: await vaultKey };
}

describe('R3.4 check-code wordlist', () => {
  it('holds 256 distinct words so four of them carry 32 bits', () => {
    expect(CHECK_WORDS).toHaveLength(256);
    expect(new Set(CHECK_WORDS.map((word) => word.en)).size).toBe(256);
    expect(new Set(CHECK_WORDS.map((word) => word.es)).size).toBe(256);
  });
});

describe('R3.4 invite links', () => {
  it('creates an invite that expires in 24 hours', async () => {
    const inviter = await generateDeviceKeyPair();
    const record = createInvite({
      roomId: 'room-1',
      tier: 'core',
      inviterPublicRaw: inviter.publicRaw,
      now: NOW,
    });
    expect(record.expiresAt - record.createdAt).toBe(INVITE_TTL_MS);
    expect(record.state).toBe('pending');
    expect(fromBase64Url(record.secretB64)).toHaveLength(32);
  });

  it('round-trips the fragment', async () => {
    const inviter = await generateDeviceKeyPair();
    const record = createInvite({ roomId: 'room-1', tier: 'core', inviterPublicRaw: inviter.publicRaw, now: NOW });
    const parsed = parseInviteFragment(inviteFragment(record));
    expect(parsed.id).toBe(record.id);
    expect(parsed.secretB64).toBe(record.secretB64);
  });

  it('refuses a link that is not an invite', () => {
    expect(() => parseInviteFragment('v1.only-two')).toThrow(InviteError);
    expect(() => parseInviteFragment('v9.a.b.c')).toThrow(InviteError);
  });

  it('strips the fragment from the address bar and from history', () => {
    const calls: string[] = [];
    const history = { replaceState: (_data: unknown, _unused: string, url?: string) => calls.push(url ?? '') };
    const cleaned = stripFragmentFromUrl('https://app.example/join#v1.abc.def.ghi?x=1', history);
    expect(cleaned).toBe('/join');
    expect(calls).toEqual(['/join']);
  });
});

describe('R3.4 join requests', () => {
  it('accepts a request that carries the invite secret', async () => {
    const inviter = await generateDeviceKeyPair();
    const invitee = await generateDeviceKeyPair();
    const record = createInvite({ roomId: 'room-1', tier: 'core', inviterPublicRaw: inviter.publicRaw, now: NOW });
    const invite = parseInviteFragment(inviteFragment(record));
    const request = await buildJoinRequest(invite, invitee.publicRaw);
    const verified = await verifyJoinRequest(invite, inviter.privateKey, request);
    expect(verified.devicePublicRaw).toEqual(invitee.publicRaw);
  });

  it('refuses a request from someone who never had the link', async () => {
    const inviter = await generateDeviceKeyPair();
    const stranger = await generateDeviceKeyPair();
    const record = createInvite({ roomId: 'room-1', tier: 'core', inviterPublicRaw: inviter.publicRaw, now: NOW });
    const invite = parseInviteFragment(inviteFragment(record));
    const forged = await buildJoinRequest(invite, stranger.publicRaw);
    const wrongSecret: ParsedInvite = { ...invite, secretB64: toBase64Url(new Uint8Array(32)) };
    await expect(verifyJoinRequest(wrongSecret, inviter.privateKey, forged)).rejects.toMatchObject({
      code: 'unauthorized',
    });
  });

  it('refuses a request whose device key was swapped', async () => {
    const inviter = await generateDeviceKeyPair();
    const invitee = await generateDeviceKeyPair();
    const attacker = await generateDeviceKeyPair();
    const record = createInvite({ roomId: 'room-1', tier: 'core', inviterPublicRaw: inviter.publicRaw, now: NOW });
    const invite = parseInviteFragment(inviteFragment(record));
    const request = await buildJoinRequest(invite, invitee.publicRaw);
    const swapped = { ...request, devicePublicB64: toBase64Url(attacker.publicRaw) };
    await expect(verifyJoinRequest(invite, inviter.privateKey, swapped)).rejects.toMatchObject({
      code: 'unauthorized',
    });
  });
});

describe('R3.4 check code', () => {
  it('gives both sides the same words', async () => {
    const inviter = await generateDeviceKeyPair();
    const invitee = await generateDeviceKeyPair();
    const record = createInvite({ roomId: 'room-1', tier: 'core', inviterPublicRaw: inviter.publicRaw, now: NOW });
    const invite = parseInviteFragment(inviteFragment(record));
    const request = await buildJoinRequest(invite, invitee.publicRaw);
    const verified = await verifyJoinRequest(invite, inviter.privateKey, request);

    const inviterCode = await computeCheckCode(
      verified.shared,
      record.id,
      inviter.publicRaw,
      verified.devicePublicRaw,
    );
    const inviteeShared = await inviteeSharedSecret(invite, invitee.privateKey);
    const inviteeCode = await computeCheckCode(
      inviteeShared,
      record.id,
      inviter.publicRaw,
      invitee.publicRaw,
    );
    expect(inviteeCode.indices).toEqual(inviterCode.indices);
    expect(inviteeCode.words).toEqual(inviterCode.words);
  });

  it('gives a different code to a different device', async () => {
    const inviter = await generateDeviceKeyPair();
    const invitee = await generateDeviceKeyPair();
    const other = await generateDeviceKeyPair();
    const record = createInvite({ roomId: 'room-1', tier: 'core', inviterPublicRaw: inviter.publicRaw, now: NOW });
    const invite = parseInviteFragment(inviteFragment(record));
    const a = await inviteeSharedSecret(invite, invitee.privateKey);
    const b = await inviteeSharedSecret(invite, other.privateKey);
    const codeA = await computeCheckCode(a, record.id, inviter.publicRaw, invitee.publicRaw);
    const codeB = await computeCheckCode(b, record.id, inviter.publicRaw, other.publicRaw);
    expect(codeA.indices).not.toEqual(codeB.indices);
  });

  it('shows the index next to the word so a mixed-language pair can compare', async () => {
    const inviter = await generateDeviceKeyPair();
    const invitee = await generateDeviceKeyPair();
    const record = createInvite({ roomId: 'room-1', tier: 'core', inviterPublicRaw: inviter.publicRaw, now: NOW });
    const invite = parseInviteFragment(inviteFragment(record));
    const shared = await inviteeSharedSecret(invite, invitee.privateKey);
    const code = await computeCheckCode(shared, record.id, inviter.publicRaw, invitee.publicRaw);
    const en = formatCheckCode(code, 'en');
    const es = formatCheckCode(code, 'es');
    expect(en).toContain(String(code.indices[0]));
    expect(es).toContain(String(code.indices[0]));
    expect(en).not.toBe(es);
  });
});

describe('R3.4 approval and key handover', () => {
  it('hands the room key to the new device and kills the invite', async () => {
    const vault = await makeVault();
    const inviter = await generateDeviceKeyPair();
    const invitee = await generateDeviceKeyPair();
    const roomKey = new Uint8Array(32).fill(9);
    const record = createInvite({ roomId: 'room-1', tier: 'core', inviterPublicRaw: inviter.publicRaw, now: NOW });
    await saveInvite(vault, record);
    const invite = parseInviteFragment(inviteFragment(record));
    const request = await buildJoinRequest(invite, invitee.publicRaw);

    const response = await approveInvite({
      vault,
      inviteId: record.id,
      inviterPrivateKey: inviter.privateKey,
      request,
      roomKey,
      checkCodeConfirmed: true,
      now: NOW + 1000,
    });
    const opened = await acceptKeyResponse(invite, invitee.privateKey, response);
    expect(opened).toEqual(roomKey);
    expect((await loadInvite(vault, record.id))?.state).toBe('used');
  });

  it('refuses a second approval of the same invite', async () => {
    const vault = await makeVault();
    const inviter = await generateDeviceKeyPair();
    const invitee = await generateDeviceKeyPair();
    const record = createInvite({ roomId: 'room-1', tier: 'core', inviterPublicRaw: inviter.publicRaw, now: NOW });
    await saveInvite(vault, record);
    const invite = parseInviteFragment(inviteFragment(record));
    const request = await buildJoinRequest(invite, invitee.publicRaw);
    const approval = {
      vault,
      inviteId: record.id,
      inviterPrivateKey: inviter.privateKey,
      request,
      roomKey: new Uint8Array(32).fill(9),
      checkCodeConfirmed: true,
      now: NOW + 1000,
    };
    await approveInvite(approval);
    await expect(approveInvite(approval)).rejects.toMatchObject({ code: 'dead' });
  });

  it('refuses an invite past its 24 hours', async () => {
    const vault = await makeVault();
    const inviter = await generateDeviceKeyPair();
    const invitee = await generateDeviceKeyPair();
    const record = createInvite({ roomId: 'room-1', tier: 'core', inviterPublicRaw: inviter.publicRaw, now: NOW });
    await saveInvite(vault, record);
    const invite = parseInviteFragment(inviteFragment(record));
    const request = await buildJoinRequest(invite, invitee.publicRaw);
    await expect(
      approveInvite({
        vault,
        inviteId: record.id,
        inviterPrivateKey: inviter.privateKey,
        request,
        roomKey: new Uint8Array(32).fill(9),
        checkCodeConfirmed: true,
        now: NOW + INVITE_TTL_MS + 1,
      }),
    ).rejects.toMatchObject({ code: 'expired' });
  });

  it('refuses to hand over the key before the human comparison', async () => {
    const vault = await makeVault();
    const inviter = await generateDeviceKeyPair();
    const invitee = await generateDeviceKeyPair();
    const record = createInvite({ roomId: 'room-1', tier: 'core', inviterPublicRaw: inviter.publicRaw, now: NOW });
    await saveInvite(vault, record);
    const invite = parseInviteFragment(inviteFragment(record));
    const request = await buildJoinRequest(invite, invitee.publicRaw);
    await expect(
      approveInvite({
        vault,
        inviteId: record.id,
        inviterPrivateKey: inviter.privateKey,
        request,
        roomKey: new Uint8Array(32).fill(9),
        checkCodeConfirmed: false,
        now: NOW + 1000,
      }),
    ).rejects.toMatchObject({ code: 'check_not_confirmed' });
  });

  it('refuses a revoked invite', async () => {
    const vault = await makeVault();
    const inviter = await generateDeviceKeyPair();
    const record = createInvite({ roomId: 'room-1', tier: 'core', inviterPublicRaw: inviter.publicRaw, now: NOW });
    await saveInvite(vault, record);
    await revokeInvite(vault, record.id);
    expect((await loadInvite(vault, record.id))?.state).toBe('revoked');
  });
});

describe('R3.4 invite storage', () => {
  it('keeps the invite secret out of the device store in readable form', async () => {
    const vault = await makeVault();
    const inviter = await generateDeviceKeyPair();
    const record = createInvite({ roomId: 'room-1', tier: 'core', inviterPublicRaw: inviter.publicRaw, now: NOW });
    await saveInvite(vault, record);
    const stored = await vault.store.get<ArrayBuffer>(`invite:${record.id}`);
    const asText = Array.from(new Uint8Array(stored!))
      .map((byte) => String.fromCharCode(byte))
      .join('');
    expect(asText).not.toContain(record.secretB64);
    expect(asText).not.toContain(record.roomId);
    expect(await listInvites(vault)).toHaveLength(1);
  });
});
