import { describe, expect, it } from 'vitest';

import { generateDeviceKeyPair, toBase64Url } from './keys';
import { queueLabel } from './mailbox';
import {
  applyRemoval,
  mailboxLabelsToDelete,
  planRemoval,
  queueDeletionProof,
  REMOVAL_NOTICE,
  RemovalError,
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

describe('R3.7 removal approval', () => {
  it('refuses one approval', async () => {
    await expect(
      planRemoval({ workspace, memberId: 'dev', approvals: ['maria'], actorId: 'maria', roomKeys }),
    ).rejects.toMatchObject({ code: 'not_enough_approvals' });
  });

  it('refuses an approval from someone who is not core', async () => {
    await expect(
      planRemoval({ workspace, memberId: 'dev', approvals: ['maria', 'rosa'], actorId: 'maria', roomKeys }),
    ).rejects.toMatchObject({ code: 'not_a_core_member' });
  });

  it('refuses to remove someone who is not a member', async () => {
    await expect(
      planRemoval({ workspace, memberId: 'stranger', approvals: ['maria', 'sam'], actorId: 'maria', roomKeys }),
    ).rejects.toMatchObject({ code: 'member_not_found' });
  });

  it('accepts two core approvals', async () => {
    const plan = await planRemoval({ workspace, memberId: 'dev', approvals: ['maria', 'sam'], actorId: 'maria', roomKeys });
    expect(plan.approvedBy).toEqual(['maria', 'sam']);
    expect(plan.removedMemberId).toBe('dev');
  });
});

describe('R3.7 removal re-keys the rooms', () => {
  it('gives the core room a new id and a new key', async () => {
    const plan = await planRemoval({ workspace, memberId: 'dev', approvals: ['maria', 'sam'], actorId: 'maria', roomKeys });
    expect(plan.newCoreRoomId).not.toBe(plan.oldCoreRoomId);
    const core = plan.rooms.find((room) => room.oldRoomId === 'core')!;
    expect(core.newKey).not.toEqual(core.oldKey);
    expect(core.newRoomId).not.toBe('core');
  });

  it('keeps the removed member out of every room that survives', async () => {
    const plan = await planRemoval({ workspace, memberId: 'dev', approvals: ['maria', 'sam'], actorId: 'maria', roomKeys });
    for (const room of plan.rooms) {
      expect(room.memberIds).not.toContain('dev');
    }
  });

  it('drops the point room of the person removed and keeps the others', async () => {
    const plan = await planRemoval({ workspace, memberId: 'rosa', approvals: ['maria', 'sam'], actorId: 'maria', roomKeys });
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
      approvals: ['maria', 'rosa'],
      actorId: 'maria',
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
    const plan = await planRemoval({ workspace, memberId: 'dev', approvals: ['maria', 'sam'], actorId: 'maria', roomKeys });
    expect(plan.notice).toBe(REMOVAL_NOTICE);
    expect(plan.notice).toContain('cannot take back');
  });
});

describe('R3.7 removal hands the new keys out', () => {
  it('seals the new key of every room to the devices that should get it', async () => {
    const plan = await planRemoval({ workspace, memberId: 'dev', approvals: ['maria', 'sam'], actorId: 'maria', roomKeys });
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
    const plan = await planRemoval({ workspace, memberId: 'dev', approvals: ['maria', 'sam'], actorId: 'maria', roomKeys });
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
