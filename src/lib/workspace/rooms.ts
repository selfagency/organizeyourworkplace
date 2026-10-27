/**
 * R3.5 rooms and the permissions matrix (04-workspace-app.md §Rooms and permissions).
 *
 * Three tiers. Core holds the full wall chart, the notes and the keys. A
 * Point person room holds one organizer's cards and nothing else. The
 * Committee room holds the issue board, the action plans and the meeting
 * notes, and no ratings and no contact list.
 *
 * Each room has its own key. Only Core holds the keys of the rooms under it,
 * so a member's tier decides what they can ever read, not what the app shows
 * them today.
 */
import { hkdf, importDevicePublicKey, sharedSecret, toBase64Url, fromBase64Url } from './keys';
import { openBytes, sealBytes } from './crypto';

export type RoomTier = 'core' | 'point' | 'committee';

export type RoomAction =
  | 'invite-core'
  | 'create-point-room'
  | 'invite-committee'
  | 'approve-join'
  | 'remove-member'
  | 'export-handoff'
  | 'view-ratings'
  | 'view-notes'
  | 'edit-ratings'
  | 'log-conversation'
  | 'manage-issues'
  | 'manage-actions'
  | 'view-members'
  | 'view-room-keys';

export type DecisionReason =
  | 'core-only'
  | 'two-core-approvals'
  | 'second-core-approval'
  | 'core-approves-join'
  | 'member-of-room'
  | 'not-a-member'
  | 'own-cards-only'
  | 'not-allowed-here';

export interface Decision {
  allowed: boolean;
  reason: DecisionReason;
}

export interface Room {
  id: string;
  tier: RoomTier;
  /** Point rooms hang off Core. Committee rooms have no parent. */
  parentId: string | null;
  memberIds: string[];
  /** The organizer whose cards a point room holds. */
  pointPersonId?: string;
}

export interface Workspace {
  coreRoomId: string;
  rooms: Room[];
}

export interface MemberDevice {
  memberId: string;
  publicB64: string;
}

export interface SealedRoomKey {
  roomId: string;
  memberId: string;
  /** Which core device sealed it, so the member can find the sender's public key. */
  senderId: string;
  sealedB64: string;
}

export function roomById(workspace: Workspace, roomId: string): Room | undefined {
  return workspace.rooms.find((room) => room.id === roomId);
}

export function coreRoom(workspace: Workspace): Room | undefined {
  return roomById(workspace, workspace.coreRoomId);
}

export function isCoreMember(workspace: Workspace, memberId: string): boolean {
  return coreRoom(workspace)?.memberIds.includes(memberId) ?? false;
}

/** Anyone in any tier: core, point person or committee. */
export function isMember(workspace: Workspace, memberId: string): boolean {
  return workspace.rooms.some(
    (room) => room.memberIds.includes(memberId) || room.pointPersonId === memberId,
  );
}

/** The tier a member holds in a room, or null when they are not in it. */
export function tierInRoom(workspace: Workspace, room: Room, memberId: string): RoomTier | null {
  if (isCoreMember(workspace, memberId)) return 'core';
  if (room.tier === 'point' && room.pointPersonId === memberId) return 'point';
  if (room.memberIds.includes(memberId)) return room.tier;
  return null;
}

export interface Permissions {
  /** Member ids of the core members who approved this action, not counting the actor. */
  approvals?: string[];
  /** Point persons only reach their own cards. */
  cardOwnerId?: string;
}

/**
 * The matrix, as data, so the app can show the same rule the code enforces.
 */
export function canPerform(
  action: RoomAction,
  actorId: string,
  room: Room,
  workspace: Workspace,
  permissions: Permissions = {},
): Decision {
  const tier = tierInRoom(workspace, room, actorId);
  if (tier === null) return { allowed: false, reason: 'not-a-member' };
  const approvals = (permissions.approvals ?? []).filter((id) => id !== actorId);
  const coreApprovers = approvals.filter((id) => isCoreMember(workspace, id));

  switch (action) {
    case 'invite-core':
    case 'create-point-room':
    case 'view-members':
    case 'view-room-keys':
      return tier === 'core'
        ? { allowed: true, reason: 'core-only' }
        : { allowed: false, reason: 'core-only' };

    case 'invite-committee':
      return tier === 'committee' || tier === 'core'
        ? { allowed: true, reason: 'core-approves-join' }
        : { allowed: false, reason: 'not-allowed-here' };

    case 'approve-join':
      return tier === 'core'
        ? { allowed: true, reason: 'core-only' }
        : { allowed: false, reason: 'core-only' };

    case 'remove-member':
      // The actor is core. The second approval is not a permission check:
      // it is an HMAC over the removal facts, made on another core member's
      // device with the room key, and removal.ts verifies it. (One seized
      // device that holds the room key could make that HMAC itself; that
      // is the price of a shared key, not a reason to re-shape the rule.)
      return tier === 'core'
        ? { allowed: true, reason: 'two-core-approvals' }
        : { allowed: false, reason: 'two-core-approvals' };

    case 'export-handoff':
      if (tier !== 'core') return { allowed: false, reason: 'core-only' };
      return coreApprovers.length >= 1
        ? { allowed: true, reason: 'second-core-approval' }
        : { allowed: false, reason: 'second-core-approval' };

    case 'view-ratings':
    case 'view-notes':
    case 'edit-ratings':
    case 'log-conversation':
      if (tier === 'core') return { allowed: true, reason: 'core-only' };
      if (tier === 'point') {
        return permissions.cardOwnerId === actorId
          ? { allowed: true, reason: 'own-cards-only' }
          : { allowed: false, reason: 'own-cards-only' };
      }
      return { allowed: false, reason: 'not-allowed-here' };

    case 'manage-issues':
    case 'manage-actions':
      return tier === 'committee' || tier === 'core'
        ? { allowed: true, reason: 'member-of-room' }
        : { allowed: false, reason: 'not-allowed-here' };
  }
}

const ROOM_KEY_INFO = 'oyw/roomkey/v1';

async function roomKeyWrapKey(shared: Uint8Array, roomId: string): Promise<CryptoKey> {
  const stretched = await hkdf(shared, new TextEncoder().encode(roomId), ROOM_KEY_INFO);
  return crypto.subtle.importKey('raw', stretched as BufferSource, 'AES-GCM', false, [
    'encrypt',
    'decrypt',
  ]);
}

/**
 * Core seals a room key to one member's device. The member needs the sender's
 * public key to open it, and the sender's id is inside the envelope.
 */
export async function sealRoomKeyForMember(
  roomKey: Uint8Array,
  roomId: string,
  sender: { id: string; privateKey: CryptoKey },
  member: MemberDevice,
): Promise<SealedRoomKey> {
  const shared = await sharedSecret(sender.privateKey, await importDevicePublicKey(fromBase64Url(member.publicB64)));
  const sealed = await sealBytes(roomKey, await roomKeyWrapKey(shared, roomId));
  return {
    roomId,
    memberId: member.memberId,
    senderId: sender.id,
    sealedB64: toBase64Url(new Uint8Array(sealed)),
  };
}

export async function openRoomKeyAsMember(
  envelope: SealedRoomKey,
  member: { privateKey: CryptoKey },
  senderPublicRaw: Uint8Array,
): Promise<Uint8Array> {
  const shared = await sharedSecret(member.privateKey, await importDevicePublicKey(senderPublicRaw));
  const opened = await openBytes(
    fromBase64Url(envelope.sealedB64).slice().buffer as ArrayBuffer,
    await roomKeyWrapKey(shared, envelope.roomId),
  );
  return opened;
}

/**
 * Which cards a member may see. Core sees everything, a point person sees the
 * cards assigned to them, the committee room holds no cards at all.
 */
export function visibleCardIds(
  workspace: Workspace,
  room: Room,
  actorId: string,
  cards: { id: string; pointPersonId?: string }[],
): string[] {
  const tier = tierInRoom(workspace, room, actorId);
  if (tier === 'core') return cards.map((card) => card.id);
  if (tier === 'point') {
    return cards.filter((card) => card.pointPersonId === actorId).map((card) => card.id);
  }
  return [];
}
