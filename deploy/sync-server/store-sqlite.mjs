/**
 * The mailbox store on a SQLite file (R3.6 mailbox, R3.9 sync server).
 *
 * The guard is the only writer. This store holds the same rows the
 * PocketBase store holds: a label, a blob, an expiry and a sequence
 * number. The blob is ciphertext the guard never opens.
 *
 * A file is the whole store, so hosting the sync server is one container
 * and one volume.
 */
import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

export function createSqliteQueueStore({ file = 'mailbox.db' } = {}) {
  if (file !== ':memory:') mkdirSync(dirname(file), { recursive: true });
  const db = new DatabaseSync(file);
  db.exec('pragma journal_mode = wal');
  db.exec('pragma synchronous = normal');
  db.exec(`
    create table if not exists queue (
      id integer primary key autoincrement,
      label text not null,
      blob text not null,
      expires_at integer not null,
      seq integer not null
    )
  `);
  db.exec('create index if not exists queue_label_seq on queue (label, seq)');

  const insert = db.prepare(
    'insert into queue (label, blob, expires_at, seq) values (?, ?, ?, ?)',
  );
  const selectAfter = db.prepare(
    'select id, blob, expires_at, seq from queue where label = ? and seq > ? order by seq asc',
  );
  const selectMax = db.prepare('select max(seq) as seq from queue where label = ?');
  const deleteLabel = db.prepare('delete from queue where label = ?');
  const deleteExpired = db.prepare('delete from queue where expires_at <= ?');
  const countRows = db.prepare('select count(*) as n from queue');

  return {
    async put(row) {
      const result = insert.run(row.label, row.blob, row.expiresAt, row.seq);
      return { id: String(result.lastInsertRowid), seq: row.seq };
    },
    async list(label, since) {
      return selectAfter.all(label, since).map((row) => ({
        id: String(row.id),
        blob: row.blob,
        expires_at: Number(row.expires_at),
        seq: Number(row.seq),
      }));
    },
    async maxSeq(label) {
      const row = selectMax.get(label);
      return row?.seq ? Number(row.seq) : 0;
    },
    async deleteLabel(label) {
      const result = deleteLabel.run(label);
      return Number(result.changes ?? 0);
    },
    async purgeExpired(now) {
      const result = deleteExpired.run(now);
      return Number(result.changes ?? 0);
    },
    async vacuum() {
      db.exec('vacuum');
      return 0;
    },
    /** How many rows the file holds. Used by the health check. */
    async size() {
      const row = countRows.get();
      return Number(row?.n ?? 0);
    },
    close() {
      db.close();
    },
  };
}
