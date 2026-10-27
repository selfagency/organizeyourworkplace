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
import { deriveRoomId, fromBase64Url, generateRoomKey, hmacKey, toBase64Url } from './keys';
import { queueLabel } from './mailbox';
import { timingSafeEqual } from './recovery';
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
  /** The core member whose device is doing the removal. */
  actorId: string;
  /**
   * The authorizations from other core members' devices: HMACs over the
   * removal facts, made with the room key on their own phone and carried
   * over as text. At least one is needed.
   */
  authorizations: string[];
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

const REMOVAL_AUTH_INFO = 'oyw/removal/auth/v1';

/**
 * The facts an authorization covers. An authorization is only good for
 * removing one member from one core room.
 */
export function removalAuthPayload(memberId: string, coreRoomId: string): string {
  return `${REMOVAL_AUTH_INFO}|${coreRoomId}|${memberId}`;
}

/**
 * The authorization a second core member's device makes.
 *
 * The device that removes does not make this: another core member opens the
 * app on their own phone, pastes in the removal request, and hands back the
 * code it produces.
 */
export async function makeRemovalAuthorization(
  roomKey: Uint8Array,
  memberId: string,
  coreRoomId: string,
): Promise<string> {
  const key = await hmacKey(roomKey);
  const mac = new Uint8Array(
    await crypto.subtle.sign(
      'HMAC',
      key,
      new TextEncoder().encode(removalAuthPayload(memberId, coreRoomId)) as BufferSource,
    ),
  );
  return toBase64Url(mac);
}

/** Checks an authorization that was pasted in. */
export async function verifyRemovalAuthorization(
  roomKey: Uint8Array,
  memberId: string,
  coreRoomId: string,
  authorization: string,
): Promise<boolean> {
  try {
    const made = base64UrlBytes(await makeRemovalAuthorization(roomKey, memberId, coreRoomId));
    return timingSafeEqual(fromBase64Url(authorization.trim()), made);
  } catch {
    return false;
  }
}

function base64UrlBytes(value: string): Uint8Array {
  return fromBase64Url(value);
}

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
  const { workspace, memberId, actorId, roomKeys } = input;
  const core = workspace.rooms.find((room) => room.id === workspace.coreRoomId);
  if (!core) throw new RemovalError('member_not_found', 'no core room');
  if (!isMember(workspace, memberId)) {
    throw new RemovalError('member_not_found', 'not a member of this workspace');
  }
  if (!isCoreMember(workspace, actorId)) {
    throw new RemovalError('not_a_core_member', 'only core can remove a member');
  }
  const coreKey = roomKeys.find((entry) => entry.roomId === workspace.coreRoomId)?.key;
  if (!coreKey) throw new RemovalError('missing_room_key', 'no key for the core room');
  // The actor is core (checked above); the permission matrix says so too.
  const decision = canPerform('remove-member', actorId, core, workspace);
  if (!decision.allowed) {
    throw new RemovalError('not_enough_approvals', decision.reason);
  }

  // The other core members' authorizations. A real one is an HMAC over these
  // removal facts, made on their own device with the room key.
  const goodAuths: string[] = [];
  for (const authorization of input.authorizations ?? []) {
    if (
      typeof authorization === 'string' &&
      authorization.trim() &&
      (await verifyRemovalAuthorization(coreKey, memberId, workspace.coreRoomId, authorization))
    ) {
      goodAuths.push(authorization.trim());
    }
  }
  if (goodAuths.length === 0) {
    throw new RemovalError(
      'not_enough_approvals',
      'the authorization from another core member is missing or wrong',
    );
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
    approvedBy: goodAuths,
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
