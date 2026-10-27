/**
 * R3.3 deniable update envelopes (05-security §Deniable edits).
 * Every Yjs update travels as: 32-byte HMAC-SHA256(roomKey, update) || update.
 * A room-key holder can verify an update is untampered; nobody can prove
 * WHICH member produced it — there are no per-device signatures.
 */
export const MAC_LEN = 32;

export async function sealUpdate(update: Uint8Array, roomKey: CryptoKey): Promise<Uint8Array> {
  const mac = new Uint8Array(await crypto.subtle.sign('HMAC', roomKey, update as BufferSource));
  const out = new Uint8Array(MAC_LEN + update.length);
  out.set(mac);
  out.set(update, MAC_LEN);
  return out;
}

export async function verifyUpdate(sealed: Uint8Array, roomKey: CryptoKey): Promise<boolean> {
  if (sealed.length < MAC_LEN) return false;
  const mac = sealed.slice(0, MAC_LEN);
  const update = sealed.slice(MAC_LEN);
  return crypto.subtle.verify('HMAC', roomKey, mac as BufferSource, update as BufferSource);
}
