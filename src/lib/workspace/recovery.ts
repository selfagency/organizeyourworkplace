/**
 * R3.7 2-of-3 recovery (05-security §Device storage and iOS: "Lost key -> 2-of-3 recovery").
 *
 * A room key is split into three shares with Shamir's secret sharing over
 * GF(2^521-1). Any two shares rebuild the key. One share reveals nothing
 * about it, which is the point: a share that leaks is not a key.
 *
 * The shares belong to members, not to the server. When a member loses their
 * device, two other holders combine their shares once, and the result is
 * handed to the new device, not kept.
 */
import { randomBytes } from './keys';
import { sealRoomKeyForMember } from './rooms';

const P = (1n << 521n) - 1n;
/** A share is a field element, so it needs room for 521 bits. */
export const SHARE_VALUE_BYTES = 66;
export const DEFAULT_SHARE_COUNT = 3;
export const DEFAULT_THRESHOLD = 2;

export interface Share {
  /** The point this share was taken at. It travels with the share. */
  index: number;
  value: Uint8Array;
}

function bytesToBigInt(bytes: Uint8Array): bigint {
  let value = 0n;
  for (const byte of bytes) value = (value << 8n) | BigInt(byte);
  return value;
}

function bigIntToBytes(value: bigint, length: number): Uint8Array {
  const out = new Uint8Array(length);
  let rest = value;
  for (let i = length - 1; i >= 0; i--) {
    out[i] = Number(rest & 0xffn);
    rest >>= 8n;
  }
  return out;
}

function mod(value: bigint): bigint {
  const result = value % P;
  return result < 0n ? result + P : result;
}

function modInverse(value: bigint): bigint {
  let [oldR, r] = [mod(value), P];
  let [oldS, s] = [1n, 0n];
  while (r !== 0n) {
    const quotient = oldR / r;
    [oldR, r] = [r, oldR - quotient * r];
    [oldS, s] = [s, oldS - quotient * s];
  }
  if (oldR !== 1n) throw new Error('not invertible');
  return mod(oldS);
}

function randomScalar(): bigint {
  return mod(bytesToBigInt(randomBytes(SHARE_VALUE_BYTES)));
}

function evaluate(coefficients: bigint[], x: bigint): bigint {
  let value = 0n;
  for (let i = coefficients.length - 1; i >= 0; i--) {
    value = (value * x + coefficients[i]) % P;
  }
  return value;
}

/**
 * Splits a secret into `count` shares, `threshold` of which rebuild it.
 * The secret must be shorter than the field, so a 32-byte key fits with
 * room to spare.
 */
export function splitSecret(
  secret: Uint8Array,
  count = DEFAULT_SHARE_COUNT,
  threshold = DEFAULT_THRESHOLD,
): Share[] {
  if (threshold < 2) throw new Error('threshold must be at least 2');
  if (count < threshold) throw new Error('count must be at least the threshold');
  const value = bytesToBigInt(secret);
  if (value >= P) throw new Error('secret does not fit the field');
  const coefficients: bigint[] = [value];
  for (let i = 1; i < threshold; i++) coefficients.push(randomScalar());
  const shares: Share[] = [];
  for (let index = 1; index <= count; index++) {
    shares.push({ index, value: bigIntToBytes(evaluate(coefficients, BigInt(index)), SHARE_VALUE_BYTES) });
  }
  return shares;
}

/**
 * Rebuilds the secret from any `threshold` shares. The index travels with
 * the share, so the holders can be any two of the three.
 */
export function combineShares(shares: Share[], threshold = DEFAULT_THRESHOLD): Uint8Array {
  if (shares.length < threshold) throw new Error('not enough shares');
  const points = shares.slice(0, threshold);
  if (new Set(points.map((point) => point.index)).size !== points.length) {
    throw new Error('two shares come from the same point');
  }
  // Lagrange interpolation at zero.
  let secret = 0n;
  for (let i = 0; i < points.length; i++) {
    const point = points[i]!;
    let numerator = 1n;
    let denominator = 1n;
    for (let j = 0; j < points.length; j++) {
      if (i === j) continue;
      const other = points[j]!;
      numerator = mod(numerator * (0n - BigInt(other.index)));
      denominator = mod(denominator * BigInt(point.index - other.index));
    }
    secret = mod(secret + bytesToBigInt(point.value) * numerator * modInverse(denominator));
  }
  return bigIntToBytes(secret, 32);
}

/** A share on its way to a holder: the index first, then the value. */
export function encodeShare(share: Share): Uint8Array {
  const out = new Uint8Array(1 + share.value.length);
  out[0] = share.index;
  out.set(share.value, 1);
  return out;
}

export function decodeShare(bytes: Uint8Array): Share {
  if (bytes.length < 1 + SHARE_VALUE_BYTES) throw new Error('not a share');
  return { index: bytes[0]!, value: bytes.slice(1) };
}

export interface RecoveryBundle {
  /** The room the key belongs to. */
  roomId: string;
  /** Which holder carries which share. */
  holders: { holderId: string; share: Share }[];
  threshold: number;
}

/** Splits a room key and hands one share to each holder. */
export function createRecoveryBundle(
  roomId: string,
  roomKey: Uint8Array,
  holderIds: string[],
  threshold = DEFAULT_THRESHOLD,
): RecoveryBundle {
  if (holderIds.length < threshold) {
    throw new Error('a recovery bundle needs at least the threshold number of holders');
  }
  const shares = splitSecret(roomKey, holderIds.length, threshold);
  return {
    roomId,
    holders: holderIds.map((holderId, index) => ({ holderId, share: shares[index]! })),
    threshold,
  };
}

/** Rebuilds the room key from the shares two holders bring. */
export function recoverRoomKey(bundle: RecoveryBundle, shares: Share[]): Uint8Array {
  if (shares.length < bundle.threshold) throw new Error('not enough shares');
  return combineShares(shares, bundle.threshold);
}

/**
 * Puts a member back in after they lost their device: the two holders
 * rebuild the key once and seal it to the new device. Nobody keeps a copy.
 */
export async function recoverIntoNewDevice(
  bundle: RecoveryBundle,
  shares: Share[],
  sealedBy: { id: string; privateKey: CryptoKey },
  newDevice: { memberId: string; publicB64: string },
): Promise<{ roomId: string; memberId: string; sealedB64: string }> {
  const roomKey = recoverRoomKey(bundle, shares);
  const envelope = await sealRoomKeyForMember(roomKey, bundle.roomId, sealedBy, newDevice);
  return { roomId: envelope.roomId, memberId: envelope.memberId, sealedB64: envelope.sealedB64 };
}
