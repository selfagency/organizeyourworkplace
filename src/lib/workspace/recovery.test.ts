import { describe, expect, it } from 'vitest';

import { randomBytes } from './keys';
import { generateDeviceKeyPair, toBase64Url } from './keys';
import {
  combineShares,
  createRecoveryBundle,
  decodeShare,
  encodeShare,
  recoverIntoNewDevice,
  recoverRoomKey,
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
