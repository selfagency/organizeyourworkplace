import { describe, expect, it } from 'vitest';

import { fromBase64Url, randomBytes, toBase64Url } from './keys';
import { generateDeviceKeyPair } from './keys';
import {
  combineShares,
  createRecoveryBundle,
  decodeShare,
  decodeShareForRoom,
  encodeShare,
  encodeShareForRoom,
  recoverIntoNewDevice,
  recoverRoomKey,
  recoverRoomKeyForRoom,
  splitSecret,
} from './recovery';

const KEY = new Uint8Array(32).fill(7);

describe('R3.7 secret sharing', () => {
  it('rebuilds the key from any two of the three shares', () => {
    const shares = splitSecret(KEY);
    expect(shares).toHaveLength(3);
    expect(combineShares([shares[0]!, shares[1]!])).toEqual(KEY);
    expect(combineShares([shares[0]!, shares[2]!])).toEqual(KEY);
    expect(combineShares([shares[1]!, shares[2]!])).toEqual(KEY);
  });

  it('refuses to rebuild from a single share', () => {
    const shares = splitSecret(KEY);
    expect(() => combineShares([shares[0]!])).toThrow();
  });

  it('refuses two copies of the same share', () => {
    const shares = splitSecret(KEY);
    expect(() => combineShares([shares[0]!, shares[0]!])).toThrow();
  });

  it('gives three different shares for the same key', () => {
    const shares = splitSecret(KEY);
    const values = shares.map((share) => share.value.join(','));
    expect(new Set(values).size).toBe(3);
  });

  it('gives a share that is not the key and carries its own randomness', () => {
    const first = splitSecret(KEY);
    const second = splitSecret(KEY);
    expect(first[0]!.value.slice(0, 32)).not.toEqual(KEY);
    expect(first[0]!.value).not.toEqual(second[0]!.value);
  });

  it('splits a different key into different shares', () => {
    const a = splitSecret(KEY);
    const b = splitSecret(new Uint8Array(32).fill(8));
    expect(a[0]!.value).not.toEqual(b[0]!.value);
  });

  it('does not rebuild the key from the wrong shares', () => {
    const shares = splitSecret(KEY);
    const other = splitSecret(randomBytes(32));
    expect(combineShares([shares[0]!, other[1]!])).not.toEqual(KEY);
  });

  it('keeps the index with the share when it is stored', () => {
    const shares = splitSecret(KEY);
    const encoded = encodeShare(shares[2]!);
    const decoded = decodeShare(encoded);
    expect(decoded.index).toBe(shares[2]!.index);
    expect(decoded.value).toEqual(shares[2]!.value);
    expect(combineShares([shares[0]!, decoded])).toEqual(KEY);
  });
});

describe('R3.7 recovery share binding (F1)', () => {
  const ROOM = 'r-testroom';
  const OTHER = 'r-otherroom';

  it('binds a share to its room, and the holder can check it', async () => {
    const shares = splitSecret(KEY);
    const coded = await encodeShareForRoom(shares[0]!, ROOM);
    const decoded = await decodeShareForRoom(coded, ROOM);
    expect(decoded.index).toBe(shares[0]!.index);
    expect(combineShares([decoded, shares[1]!])).toEqual(KEY);
  });

  it('refuses a share from another room', async () => {
    const shares = splitSecret(KEY);
    const coded = await encodeShareForRoom(shares[0]!, ROOM);
    await expect(decodeShareForRoom(coded, OTHER)).rejects.toThrow('does not belong to this room');
  });

  it('refuses a share that was changed on the way', async () => {
    const shares = splitSecret(KEY);
    const coded = await encodeShareForRoom(shares[0]!, ROOM);
    const bytes = fromBase64Url(coded);
    bytes[1] = bytes[1]! ^ 1;
    await expect(decodeShareForRoom(toBase64Url(bytes), ROOM)).rejects.toThrow();
  });

  it('refuses something that is no share at all', async () => {
    await expect(decodeShareForRoom('AAAA', ROOM)).rejects.toThrow();
  });

  it('rebuilds through the room-bound door, and refuses wrong-room shares there', async () => {
    const bundle = createRecoveryBundle(ROOM, KEY, ['maria', 'sam', 'dev']);
    const inRoom = await Promise.all(
      bundle.holders.slice(0, 2).map((holder) => encodeShareForRoom(holder.share, ROOM)),
    );
    expect(await recoverRoomKeyForRoom(ROOM, inRoom)).toEqual(KEY);

    const elsewhere = createRecoveryBundle(OTHER, KEY, ['maria', 'sam', 'dev']);
    const wrong = await Promise.all(
      elsewhere.holders.slice(0, 2).map((holder) => encodeShareForRoom(holder.share, OTHER)),
    );
    await expect(recoverRoomKeyForRoom(ROOM, wrong)).rejects.toThrow('does not belong to this room');
  });

  it('refuses to rebuild with fewer shares than the threshold', async () => {
    const bundle = createRecoveryBundle(ROOM, KEY, ['maria', 'sam', 'dev']);
    const one = await encodeShareForRoom(bundle.holders[0]!.share, ROOM);
    await expect(recoverRoomKeyForRoom(ROOM, [one])).rejects.toThrow('recovery needs 2 shares');
  });
});

describe('R3.7 recovery bundle', () => {
  it('gives one share to each holder', () => {
    const bundle = createRecoveryBundle('core', KEY, ['maria', 'sam', 'dev']);
    expect(bundle.holders.map((holder) => holder.holderId)).toEqual(['maria', 'sam', 'dev']);
    expect(bundle.threshold).toBe(2);
  });

  it('recovers the key when two holders bring their shares', () => {
    const bundle = createRecoveryBundle('core', KEY, ['maria', 'sam', 'dev']);
    const fromMaria = bundle.holders.find((holder) => holder.holderId === 'maria')!.share;
    const fromDev = bundle.holders.find((holder) => holder.holderId === 'dev')!.share;
    expect(recoverRoomKey(bundle, [fromMaria, fromDev])).toEqual(KEY);
  });

  it('refuses a bundle with too few holders', () => {
    expect(() => createRecoveryBundle('core', KEY, ['maria'])).toThrow();
  });

  it('puts a member back in on a new device', async () => {
    const bundle = createRecoveryBundle('core', KEY, ['maria', 'sam', 'dev']);
    const holderDevice = await generateDeviceKeyPair();
    const newDevice = await generateDeviceKeyPair();
    const fromSam = bundle.holders.find((holder) => holder.holderId === 'sam')!.share;
    const fromDev = bundle.holders.find((holder) => holder.holderId === 'dev')!.share;
    const envelope = await recoverIntoNewDevice(
      bundle,
      [fromSam, fromDev],
      { id: 'sam', privateKey: holderDevice.privateKey },
      { memberId: 'maria', publicB64: toBase64Url(newDevice.publicRaw) },
    );
    expect(envelope.memberId).toBe('maria');
    expect(envelope.roomId).toBe('core');
    expect(envelope.sealedB64.length).toBeGreaterThan(20);
  });
});
