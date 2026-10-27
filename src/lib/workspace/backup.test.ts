import { describe, expect, it } from 'vitest';

import * as Y from 'yjs';

import { BackupError, captureRooms, createBackupFile, openBackupFile, restoreRooms } from './backup';
import { createRoomDoc, setRating, upsertCoworker } from './model';

const PASSPHRASE = 'committee passphrase';

function docWithARating(): Y.Doc {
  const doc = createRoomDoc();
  upsertCoworker(doc, { id: 'c1', displayName: 'Rosa', dept: 'Dairy', shift: 'nights', language: 'es' });
  setRating(doc, 'c1', 2, '2026-10-24', 'maria');
  return doc;
}

describe('R3.7 encrypted backups', () => {
  it('opens with the right passphrase', async () => {
    const payload = captureRooms('maria', [
      { roomId: 'core', doc: docWithARating(), key: new Uint8Array(32).fill(5) },
    ]);
    const file = await createBackupFile(payload, PASSPHRASE);
    const opened = await openBackupFile(file, PASSPHRASE);
    expect(opened.memberId).toBe('maria');
    expect(opened.rooms).toHaveLength(1);
  });

  it('fails with the wrong passphrase', async () => {
    const payload = captureRooms('maria', []);
    const file = await createBackupFile(payload, PASSPHRASE);
    await expect(openBackupFile(file, 'other passphrase')).rejects.toMatchObject({
      code: 'wrong_passphrase',
    });
  });

  it('fails when a byte of the file is changed', async () => {
    const payload = captureRooms('maria', []);
    const file = await createBackupFile(payload, PASSPHRASE);
    const tampered = file.slice();
    tampered[tampered.length - 1] ^= 0xff;
    await expect(openBackupFile(tampered, PASSPHRASE)).rejects.toMatchObject({
      code: 'wrong_passphrase',
    });
  });

  it('refuses a file that is not a backup', async () => {
    await expect(openBackupFile(new Uint8Array([1, 2, 3]), PASSPHRASE)).rejects.toMatchObject({
      code: 'not_a_backup',
    });
  });

  it('keeps the passphrase and the keys out of the file', async () => {
    const payload = captureRooms('maria', [
      { roomId: 'core', doc: docWithARating(), key: new Uint8Array(32).fill(5) },
    ]);
    const file = await createBackupFile(payload, PASSPHRASE);
    const asText = new TextDecoder('latin1').decode(file);
    expect(asText).not.toContain(PASSPHRASE);
    expect(asText).not.toContain('Rosa');
    expect(asText).not.toContain('Dairy');
  });

  it('restores the rooms and their contents', async () => {
    const payload = captureRooms('maria', [
      { roomId: 'core', doc: docWithARating(), key: new Uint8Array(32).fill(5) },
    ]);
    const file = await createBackupFile(payload, PASSPHRASE);
    const opened = await openBackupFile(file, PASSPHRASE);
    const restored = restoreRooms(opened);
    expect(restored).toHaveLength(1);
    expect(restored[0]!.key).toEqual(new Uint8Array(32).fill(5));
    const card = restored[0]!.doc.getMap('coworkers').get('c1') as Y.Map<unknown>;
    expect(card.get('displayName')).toBe('Rosa');
  });

  it('gives a different file every time', async () => {
    const payload = captureRooms('maria', []);
    const a = await createBackupFile(payload, PASSPHRASE);
    const b = await createBackupFile(payload, PASSPHRASE);
    expect(a).not.toEqual(b);
  });
});
