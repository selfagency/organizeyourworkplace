import { describe, expect, it } from 'vitest';

import { generateDeviceKeyPair, toBase64Url } from './keys';
import { queueLabel } from './mailbox';
import {
  applyRemoval,
  mailboxLabelsToDelete,
  makeRemovalAuthorization,
  planRemoval,
  REMOVAL_NOTICE,
  removalAuthPayload,
  RemovalError,
  queueDeletionProof,
  roomSurvives,
  type RoomKey,
} from './removal';
import type { Workspace } from './rooms';

const NOW = new Date(Date.UTC(2026, 9, 27, 12, 0, 0));

const workspace: Workspace = {
  coreRoomId: 'core',
  rooms: [
    { id: 'core', tier: 'core', parentId: null, memberIds: ['maria', 'sam', 'dev'] },
    { id: 'point-rosa', tier: 'point', parentId: 'core', memberIds: [], pointPersonId: 'rosa' },
    { id: 'point-lee', tier: 'point', parentId: 'core', memberIds: [], pointPersonId: 'lee' },
    { id: 'committee', tier: 'committee', parentId: null, memberIds: ['maria', 'rosa', 'lee'] },
  ],
};

const roomKeys: RoomKey[] = [
  { roomId: 'core', key: new Uint8Array(32).fill(1) },
  { roomId: 'point-rosa', key: new Uint8Array(32).fill(2) },
  { roomId: 'point-lee', key: new Uint8Array(32).fill(3) },
  { roomId: 'committee', key: new Uint8Array(32).fill(4) },
];

/** The authorization another core member's device would make. */
async function authFromSam(memberId: string): Promise<string> {
  return makeRemovalAuthorization(new Uint8Array(32).fill(1), memberId, 'core');
}

describe('R3.7 removal authorization', () => {
  it('refuses to remove without an authorization', async () => {
    await expect(
      planRemoval({ workspace, memberId: 'dev', actorId: 'maria', authorizations: [], roomKeys }),
    ).rejects.toMatchObject({ code: 'not_enough_approvals' });
  });

  it('refuses an authorization made for a different member', async () => {
    const wrong = await authFromSam('sam');
    await expect(
      planRemoval({ workspace, memberId: 'dev', actorId: 'maria', authorizations: [wrong], roomKeys }),
    ).rejects.toMatchObject({ code: 'not_enough_approvals' });
  });

  it('refuses an authorization made for a different room', async () => {
    const wrong = await makeRemovalAuthorization(new Uint8Array(32).fill(1), 'dev', 'core-elsewhere');
    await expect(
      planRemoval({ workspace, memberId: 'dev', actorId: 'maria', authorizations: [wrong], roomKeys }),
    ).rejects.toMatchObject({ code: 'not_enough_approvals' });
  });

  it('refuses garbage', async () => {
    await expect(
      planRemoval({ workspace, memberId: 'dev', actorId: 'maria', authorizations: ['hello'], roomKeys }),
    ).rejects.toMatchObject({ code: 'not_enough_approvals' });
  });

  it('refuses to remove someone who is not a member', async () => {
    const good = await authFromSam('stranger');
    await expect(
      planRemoval({ workspace, memberId: 'stranger', actorId: 'maria', authorizations: [good], roomKeys }),
    ).rejects.toMatchObject({ code: 'member_not_found' });
  });

  it('accepts an authorization from another core member, with the facts it covers', async () => {
    const good = await authFromSam('dev');
    const plan = await planRemoval({
      workspace,
      memberId: 'dev',
      actorId: 'maria',
      authorizations: [good],
      roomKeys,
    });
    expect(plan.approvedBy).toEqual([good]);
    expect(plan.removedMemberId).toBe('dev');
  });

  it('covers the exact facts it names', () => {
    expect(removalAuthPayload('dev', 'core')).toBe('oyw/removal/auth/v1|core|dev');
  });
});

describe('R3.7 removal re-keys the rooms', () => {
  it('gives the core room a new id and a new key', async () => {
    const plan = await planRemoval({
      workspace,
      memberId: 'dev',
      actorId: 'maria',
      authorizations: [await authFromSam('dev')],
      roomKeys,
    });
    expect(plan.newCoreRoomId).not.toBe(plan.oldCoreRoomId);
    const core = plan.rooms.find((room) => room.oldRoomId === 'core')!;
    expect(core.newKey).not.toEqual(core.oldKey);
    expect(core.newRoomId).not.toBe('core');
  });

  it('keeps the removed member out of every room that survives', async () => {
    const plan = await planRemoval({
      workspace,
      memberId: 'dev',
      actorId: 'maria',
      authorizations: [await authFromSam('dev')],
      roomKeys,
    });
    for (const room of plan.rooms) {
      expect(room.memberIds).not.toContain('dev');
    }
  });

  it('drops the point room of the person removed and keeps the others', async () => {
    const plan = await planRemoval({
      workspace,
      memberId: 'rosa',
      actorId: 'maria',
      authorizations: [await authFromSam('rosa')],
      roomKeys,
    });
    expect(plan.droppedRoomIds).toContain('point-rosa');
    expect(plan.droppedRoomIds).not.toContain('point-lee');
    expect(plan.rooms.map((room) => room.oldRoomId)).toContain('point-lee');
  });

  it('drops a room that nobody else can reach', async () => {
    const onlyRosa: Workspace = {
      coreRoomId: 'core',
      rooms: [
        { id: 'core', tier: 'core', parentId: null, memberIds: ['maria', 'rosa'] },
        { id: 'point-rosa', tier: 'point', parentId: 'core', memberIds: [], pointPersonId: 'rosa' },
      ],
    };
    const plan = await planRemoval({
      workspace: onlyRosa,
      memberId: 'rosa',
      actorId: 'maria',
      authorizations: [await authFromSam('rosa')],
      roomKeys: roomKeys.slice(0, 2),
    });
    expect(plan.droppedRoomIds).toEqual(['point-rosa']);
  });

  it('knows which rooms survive', () => {
    const core = workspace.rooms[0]!;
    const point = workspace.rooms[1]!;
    expect(roomSurvives(core, 'dev', workspace)).toBe(true);
    expect(roomSurvives(point, 'rosa', workspace)).toBe(false);
    expect(roomSurvives(point, 'dev', workspace)).toBe(true);
  });

  it('says plainly that past syncs cannot be taken back', async () => {
    const plan = await planRemoval({
      workspace,
      memberId: 'dev',
      actorId: 'maria',
      authorizations: [await authFromSam('dev')],
      roomKeys,
    });
    expect(plan.notice).toBe(REMOVAL_NOTICE);
    expect(plan.notice).toContain('cannot take back');
  });
});

describe('R3.7 removal hands the new keys out', () => {
  it('seals the new key of every room to the devices that should get it', async () => {
    const plan = await planRemoval({
      workspace,
      memberId: 'dev',
      actorId: 'maria',
      authorizations: [await authFromSam('dev')],
      roomKeys,
    });
    const coreDevice = await generateDeviceKeyPair();
    const mariaDevice = await generateDeviceKeyPair();
    const leeDevice = await generateDeviceKeyPair();
    const distribution = await applyRemoval(
      plan,
      { id: 'maria', privateKey: coreDevice.privateKey },
      [
        { memberId: 'maria', publicB64: toBase64Url(mariaDevice.publicRaw) },
        { memberId: 'lee', publicB64: toBase64Url(leeDevice.publicRaw) },
      ],
    );
    expect(distribution.envelopes.length).toBeGreaterThan(0);
    expect(distribution.envelopes.every((envelope) => envelope.memberId !== 'dev')).toBe(true);
  });
});

describe('R3.7 removal clears the old mailbox queue', () => {
  it('names the queue of every old room key', async () => {
    const plan = await planRemoval({
      workspace,
      memberId: 'dev',
      actorId: 'maria',
      authorizations: [await authFromSam('dev')],
      roomKeys,
    });
    const labels = await mailboxLabelsToDelete(plan, NOW);
    const expected = await queueLabel(new Uint8Array(32).fill(1), NOW);
    expect(labels).toContain(expected);
    expect(labels).toHaveLength(plan.rooms.length);
  });

  it('gives a proof that the client meant to delete the queue', async () => {
    const oldKey = new Uint8Array(32).fill(1);
    const label = await queueLabel(oldKey, NOW);
    const proof = await queueDeletionProof(oldKey, label);
    expect(proof.length).toBeGreaterThan(20);
  });
});
