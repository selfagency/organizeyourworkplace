import { describe, expect, it } from 'vitest';

import {
  fromBase64Url,
  generateDeviceKeyPair,
  hkdf,
  importDevicePublicKey,
  randomBytes,
  roomMacKey,
  sharedSecret,
  toBase64Url,
} from './keys';
import { sealUpdate, verifyUpdate } from './envelope';

describe('R3.4 key primitives', () => {
  it('round-trips base64url for every padding length', () => {
    for (let length = 0; length <= 40; length++) {
      const bytes = randomBytes(length);
      expect(fromBase64Url(toBase64Url(bytes))).toEqual(bytes);
    }
  });

  it('rejects strings that are not base64url', () => {
    expect(() => fromBase64Url('abc+def')).toThrow();
  });

  it('reaches the same shared secret on both sides', async () => {
    const a = await generateDeviceKeyPair();
    const b = await generateDeviceKeyPair();
    const fromA = await sharedSecret(a.privateKey, await importDevicePublicKey(b.publicRaw));
    const fromB = await sharedSecret(b.privateKey, await importDevicePublicKey(a.publicRaw));
    expect(fromA).toEqual(fromB);
    expect(fromA.length).toBe(32);
  });

  it('gives a different secret to a different device', async () => {
    const a = await generateDeviceKeyPair();
    const b = await generateDeviceKeyPair();
    const c = await generateDeviceKeyPair();
    const ab = await sharedSecret(a.privateKey, await importDevicePublicKey(b.publicRaw));
    const ac = await sharedSecret(a.privateKey, await importDevicePublicKey(c.publicRaw));
    expect(ab).not.toEqual(ac);
  });

  it('keeps the device private key unextractable', async () => {
    const pair = await generateDeviceKeyPair();
    await expect(crypto.subtle.exportKey('pkcs8', pair.privateKey)).rejects.toThrow();
  });

  it('stretches a secret into separate subkeys per purpose', async () => {
    const secret = randomBytes(32);
    const mac = await hkdf(secret, new Uint8Array([1]), 'update-mac');
    const content = await hkdf(secret, new Uint8Array([1]), 'content');
    expect(mac).not.toEqual(content);
    expect(await hkdf(secret, new Uint8Array([1]), 'update-mac')).toEqual(mac);
  });

  it('signs room updates with the room key subkey', async () => {
    const roomKey = randomBytes(32);
    const key = await roomMacKey(roomKey);
    const update = new Uint8Array([1, 2, 3, 4]);
    const sealed = await sealUpdate(update, key);
    expect(await verifyUpdate(sealed, key)).toBe(true);
    expect(await verifyUpdate(sealed, await roomMacKey(randomBytes(32)))).toBe(false);
  });
});
