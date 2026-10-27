/**
 * R3.7 removal and re-key (05-security §Removal).
 *
 * Removing someone cuts off their future updates and nothing else. What
 * they already synced cannot be taken back, and the app has to say that
 * plainly rather than hint at it.
 *
 * The mechanics: two core members approve, the surviving rooms get new keys
 * and new room ids, the removed member's point room is dropped so the
 * exposure of that tier stops, and the old mailbox queue is deleted.
 */
import { deriveRoomId, generateRoomKey, hmacKey } from './keys';
import { queueLabel } from './mailbox';
import { canPerform, isCoreMember, isMember, sealRoomKeyForMember, type Room, type Workspace } from './rooms';

export const REMOVAL_NOTICE =
  'Removal cuts off future updates. It cannot take back what this person already synced. ' +
  'Anything they copied off the app is theirs now.';

export interface RoomKey {
  roomId: string;
  key: Uint8Array;
}

export interface RemovalInput {
  workspace: Workspace;
  memberId: string;
  /** The core members who approved. Two are needed, one of them the actor. */
  approvals: string[];
  /** The core member whose device is doing the removal. */
  actorId: string;
  /** The current keys, by room. */
  roomKeys: RoomKey[];
}

export interface RemovalRoom {
  oldRoomId: string;
  newRoomId: string;
  oldKey: Uint8Array;
  newKey: Uint8Array;
  memberIds: string[];
}

export interface RemovalPlan {
  removedMemberId: string;
  approvedBy: string[];
  oldCoreRoomId: string;
  newCoreRoomId: string;
  /** The rooms that keep living, with fresh keys. */
  rooms: RemovalRoom[];
  /** The rooms that go away with the removed member. */
  droppedRoomIds: string[];
  notice: string;
}

export type RemovalErrorCode =
  | 'not_enough_approvals'
  | 'not_a_core_member'
  | 'member_not_found'
  | 'missing_room_key';

export class RemovalError extends Error {
  readonly code: RemovalErrorCode;

  constructor(code: RemovalErrorCode, message?: string) {
    super(message ?? code);
    this.name = 'RemovalError';
    this.code = code;
  }
}

/** A room survives when someone other than the removed member can reach it. */
export function roomSurvives(room: Room, memberId: string, workspace: Workspace): boolean {
  if (isCoreMember(workspace, memberId)) {
    // The core room always survives, re-keyed. A point room belonging to the
    // removed member does not.
    if (room.tier === 'point') return room.pointPersonId !== memberId;
    return true;
  }
  if (room.tier === 'point') return room.pointPersonId !== memberId;
  return room.memberIds.some((id) => id !== memberId);
}

/**
 * Works out what the removal does. Nothing is sent and no key changes
 * until the plan is applied, so the committee can look at it first.
 */
export async function planRemoval(input: RemovalInput): Promise<RemovalPlan> {
  const { workspace, memberId, approvals, actorId, roomKeys } = input;
  const core = workspace.rooms.find((room) => room.id === workspace.coreRoomId);
  if (!core) throw new RemovalError('member_not_found', 'no core room');
  if (!isMember(workspace, memberId)) {
    throw new RemovalError('member_not_found', 'not a member of this workspace');
  }
  if (!isCoreMember(workspace, actorId)) {
    throw new RemovalError('not_a_core_member', 'only core can remove a member');
  }
  const distinct = [...new Set(approvals)];
  if (distinct.length < 2) {
    throw new RemovalError('not_enough_approvals', 'two core members must approve');
  }
  for (const approver of distinct) {
    if (!isCoreMember(workspace, approver)) {
      throw new RemovalError('not_a_core_member', `${approver} is not core`);
    }
  }
  const decision = canPerform('remove-member', actorId, core, workspace, { approvals: distinct });
  if (!decision.allowed) {
    throw new RemovalError('not_enough_approvals', decision.reason);
  }

  const keyByRoom = new Map(roomKeys.map((entry) => [entry.roomId, entry.key]));
  const rooms: RemovalRoom[] = [];
  const droppedRoomIds: string[] = [];

  for (const room of workspace.rooms) {
    const oldKey = keyByRoom.get(room.id);
    if (!oldKey) throw new RemovalError('missing_room_key', `no key for room ${room.id}`);
    if (!roomSurvives(room, memberId, workspace)) {
      droppedRoomIds.push(room.id);
      continue;
    }
    const newKey = generateRoomKey();
    const memberIds = room.memberIds.filter((id) => id !== memberId);
    rooms.push({
      oldRoomId: room.id,
      newRoomId: await deriveRoomId(newKey),
      oldKey,
      newKey,
      memberIds,
    });
  }

  const coreRoomPlan = rooms.find((room) => room.oldRoomId === workspace.coreRoomId);
  if (!coreRoomPlan) throw new RemovalError('missing_room_key', 'no key for the core room');

  return {
    removedMemberId: memberId,
    approvedBy: distinct,
    oldCoreRoomId: workspace.coreRoomId,
    newCoreRoomId: coreRoomPlan.newRoomId,
    rooms,
    droppedRoomIds,
    notice: REMOVAL_NOTICE,
  };
}

/**
 * The mailbox queues that go with the old room keys. A queue is named after
 * the room key and the day, so the client can name every queue to delete.
 */
export async function mailboxLabelsToDelete(plan: RemovalPlan, now: Date): Promise<string[]> {
  const labels: string[] = [];
  for (const room of plan.rooms) {
    labels.push(await queueLabel(room.oldKey, now));
  }
  return [...new Set(labels)];
}

/**
 * A proof that the client can delete a queue: the room key signs the label.
 * The guard cannot check it, so the label itself is the capability. This
 * proof is what the client keeps to show it meant to.
 */
export async function queueDeletionProof(oldKey: Uint8Array, label: string): Promise<string> {
  const key = await hmacKey(oldKey);
  const mac = new Uint8Array(
    await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(`delete|${label}`)),
  );
  return btoa(String.fromCharCode(...mac)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export interface MemberDevice {
  memberId: string;
  publicB64: string;
}

export interface RemovalDistribution {
  /** The new key of each surviving room, sealed to one device. */
  envelopes: Awaited<ReturnType<typeof sealRoomKeyForMember>>[];
  /** The core device that did the sealing. */
  sealedBy: string;
}

/**
 * Hands the new keys to the remaining devices. The removed member's device
 * is not in the list, so it gets nothing.
 */
export async function applyRemoval(
  plan: RemovalPlan,
  sealedBy: { id: string; privateKey: CryptoKey },
  devices: MemberDevice[],
): Promise<RemovalDistribution> {
  const envelopes = [];
  for (const room of plan.rooms) {
    for (const device of devices) {
      if (!room.memberIds.includes(device.memberId)) continue;
      envelopes.push(
        await sealRoomKeyForMember(room.newKey, room.newRoomId, sealedBy, device),
      );
    }
  }
  return { envelopes, sealedBy: sealedBy.id };
}
