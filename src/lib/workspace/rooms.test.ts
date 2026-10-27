import { describe, expect, it } from 'vitest';

import { generateDeviceKeyPair, toBase64Url } from './keys';
import {
  canPerform,
  coreRoom,
  isCoreMember,
  openRoomKeyAsMember,
  roomById,
  sealRoomKeyForMember,
  tierInRoom,
  visibleCardIds,
  type Workspace,
} from './rooms';

const workspace: Workspace = {
  coreRoomId: 'core',
  rooms: [
    { id: 'core', tier: 'core', parentId: null, memberIds: ['maria', 'sam'] },
    { id: 'point-rosa', tier: 'point', parentId: 'core', memberIds: [], pointPersonId: 'rosa' },
    { id: 'committee', tier: 'committee', parentId: null, memberIds: ['rosa', 'dev', 'lee'] },
  ],
};

const core = roomById(workspace, 'core')!;
const point = roomById(workspace, 'point-rosa')!;
const committee = roomById(workspace, 'committee')!;

describe('R3.5 room tiers', () => {
  it('puts core members in every tier and leaves the rest in their own', () => {
    expect(tierInRoom(workspace, committee, 'maria')).toBe('core');
    expect(tierInRoom(workspace, committee, 'dev')).toBe('committee');
    expect(tierInRoom(workspace, point, 'rosa')).toBe('point');
    expect(tierInRoom(workspace, committee, 'rosa')).toBe('committee');
    expect(tierInRoom(workspace, committee, 'nobody')).toBeNull();
  });

  it('knows who holds a core seat', () => {
    expect(isCoreMember(workspace, 'maria')).toBe(true);
    expect(isCoreMember(workspace, 'dev')).toBe(false);
    expect(coreRoom(workspace)?.id).toBe('core');
  });
});

describe('R3.5 permissions matrix', () => {
  it('lets only core invite to core and open point rooms', () => {
    expect(canPerform('invite-core', 'maria', core, workspace).allowed).toBe(true);
    expect(canPerform('invite-core', 'rosa', core, workspace).allowed).toBe(false);
    expect(canPerform('create-point-room', 'dev', core, workspace).allowed).toBe(false);
  });

  it('lets any member ask to join the committee, but only core approves', () => {
    expect(canPerform('invite-committee', 'dev', committee, workspace).allowed).toBe(true);
    expect(canPerform('approve-join', 'dev', committee, workspace).allowed).toBe(false);
    expect(canPerform('approve-join', 'maria', committee, workspace).allowed).toBe(true);
  });

  it('needs two core members to remove someone', () => {
    expect(canPerform('remove-member', 'maria', core, workspace).allowed).toBe(false);
    expect(
      canPerform('remove-member', 'maria', core, workspace, { approvals: ['sam'] }).allowed,
    ).toBe(false);
    expect(
      canPerform('remove-member', 'maria', core, workspace, { approvals: ['sam', 'lee'] }).allowed,
    ).toBe(false);
  });

  it('needs a second core member for the handoff export', () => {
    expect(canPerform('export-handoff', 'maria', core, workspace).allowed).toBe(false);
    expect(
      canPerform('export-handoff', 'maria', core, workspace, { approvals: ['sam'] }).allowed,
    ).toBe(true);
    expect(
      canPerform('export-handoff', 'dev', core, workspace, { approvals: ['maria', 'sam'] }).allowed,
    ).toBe(false);
  });

  it('keeps ratings and notes to core, and to point persons for their own cards', () => {
    expect(canPerform('view-ratings', 'maria', core, workspace).allowed).toBe(true);
    expect(canPerform('view-ratings', 'dev', committee, workspace).allowed).toBe(false);
    expect(
      canPerform('view-ratings', 'rosa', point, workspace, { cardOwnerId: 'rosa' }).allowed,
    ).toBe(true);
    expect(
      canPerform('view-ratings', 'rosa', point, workspace, { cardOwnerId: 'dev' }).allowed,
    ).toBe(false);
  });

  it('does not let a stranger act in a room', () => {
    expect(canPerform('view-ratings', 'stranger', core, workspace)).toEqual({
      allowed: false,
      reason: 'not-a-member',
    });
  });
});

describe('R3.5 card scope', () => {
  const cards = [
    { id: 'c1', pointPersonId: 'rosa' },
    { id: 'c2', pointPersonId: 'dev' },
    { id: 'c3' },
  ];

  it('gives core every card and a point person only their own', () => {
    expect(visibleCardIds(workspace, core, 'maria', cards)).toEqual(['c1', 'c2', 'c3']);
    expect(visibleCardIds(workspace, point, 'rosa', cards)).toEqual(['c1']);
  });

  it('gives the committee room no cards at all', () => {
    expect(visibleCardIds(workspace, committee, 'dev', cards)).toEqual([]);
  });
});

describe('R3.5 room keys', () => {
  it('hands a room key to one member and keeps it from everyone else', async () => {
    const coreDevice = await generateDeviceKeyPair();
    const memberDevice = await generateDeviceKeyPair();
    const roomKey = new Uint8Array(32).fill(6);
    const envelope = await sealRoomKeyForMember(
      roomKey,
      'committee',
      { id: 'maria', privateKey: coreDevice.privateKey },
      { memberId: 'dev', publicB64: toBase64Url(memberDevice.publicRaw) },
    );
    const opened = await openRoomKeyAsMember(
      envelope,
      { privateKey: memberDevice.privateKey },
      coreDevice.publicRaw,
    );
    expect(opened).toEqual(roomKey);
  });

  it('gives a different room a different key', async () => {
    const coreDevice = await generateDeviceKeyPair();
    const memberDevice = await generateDeviceKeyPair();
    const roomKey = new Uint8Array(32).fill(6);
    const one = await sealRoomKeyForMember(
      roomKey,
      'point-rosa',
      { id: 'maria', privateKey: coreDevice.privateKey },
      { memberId: 'rosa', publicB64: toBase64Url(memberDevice.publicRaw) },
    );
    const other = await sealRoomKeyForMember(
      roomKey,
      'committee',
      { id: 'maria', privateKey: coreDevice.privateKey },
      { memberId: 'rosa', publicB64: toBase64Url(memberDevice.publicRaw) },
    );
    expect(one.sealedB64).not.toBe(other.sealedB64);
  });

  it('refuses to open the key with the wrong device', async () => {
    const coreDevice = await generateDeviceKeyPair();
    const memberDevice = await generateDeviceKeyPair();
    const otherDevice = await generateDeviceKeyPair();
    const envelope = await sealRoomKeyForMember(
      new Uint8Array(32).fill(6),
      'committee',
      { id: 'maria', privateKey: coreDevice.privateKey },
      { memberId: 'dev', publicB64: toBase64Url(memberDevice.publicRaw) },
    );
    await expect(
      openRoomKeyAsMember(envelope, { privateKey: otherDevice.privateKey }, coreDevice.publicRaw),
    ).rejects.toThrow();
  });
});
