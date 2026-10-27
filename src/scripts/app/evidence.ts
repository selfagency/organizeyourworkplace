/**
 * Screen 9: the evidence locker.
 *
 * The list, the form, and the export. The files go into the encrypted
 * room, so they reach the other devices and not the server.
 */
import { appCatalogs, type AppStringKey } from '../../i18n/app';
import { onDocChange, type Session } from '../../lib/workspace/app-state';
import {
  evidenceCsv,
  evidenceTimeline,
  formatBytes,
  KIND_LABELS,
  lockerItems,
  MAX_FILE_BYTES,
} from '../../lib/workspace/evidence';
import {
  addEvidence,
  memberList,
  removeEvidence,
  type EvidenceKind,
} from '../../lib/workspace/model';
import { el, lang, withSession } from './shared';
import type * as Y from 'yjs';

const t = (key: AppStringKey): string => appCatalogs[lang()][key];

let session: Session | null = null;
let doc: Y.Doc | null = null;

function nameOf(memberId: string): string {
  if (!doc) return memberId;
  return memberList(doc).find((member) => member.id === memberId)?.name ?? memberId;
}

function render(): void {
  const container = el<HTMLElement>('[data-evidence-body]');
  if (!container || !doc) return;
  const items = lockerItems(doc);
  const exportSection = el<HTMLElement>('[data-evidence-export]');
  if (exportSection) exportSection.hidden = items.length === 0;

  if (items.length === 0) {
    const box = document.createElement('div');
    box.className = 'state well--empty';
    const title = document.createElement('p');
    title.className = 'state__title';
    title.textContent = t('app.evidence.emptyTitle');
    const body = document.createElement('p');
    body.className = 'state__body';
    body.textContent = t('app.evidence.emptyBody');
    box.append(title, body);
    container.replaceChildren(box);
    return;
  }

  const list = document.createElement('ul');
  list.className = 'timeline';
  for (const item of items) {
    const entry = document.createElement('li');
    entry.className = 'timeline__item';
    const when = document.createElement('p');
    when.className = 'timeline__when';
    when.textContent = item.at;
    const what = document.createElement('p');
    what.className = 'timeline__what';
    what.textContent = `${KIND_LABELS[item.kind][lang()]} · ${item.description}`;
    const by = document.createElement('p');
    by.className = 'timeline__when';
    by.textContent = t('app.evidence.addedBy').replace('{name}', nameOf(item.by));
    entry.append(when, what, by);
    if (item.fileName) {
      const file = document.createElement('p');
      file.className = 'timeline__when';
      file.textContent = item.fileName;
      entry.append(file);
    }
    const remove = document.createElement('button');
    remove.className = 'button button--danger';
    remove.type = 'button';
    remove.textContent = t('app.evidence.remove');
    remove.addEventListener('click', async () => {
      removeEvidence(doc!, item.id);
      await session?.save();
      render();
    });
    entry.append(remove);
    list.append(entry);
  }
  container.replaceChildren(list);
}

function download(name: string, content: string, type: string): void {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

el<HTMLFormElement>('[data-evidence-form]')?.addEventListener('submit', async (event) => {
  event.preventDefault();
  if (!session || !doc) return;
  const form = event.currentTarget as HTMLFormElement;
  const data = new FormData(form);
  const description = String(data.get('description') ?? '').trim();
  const error = el<HTMLElement>('[data-evidence-error]');
  if (!description) {
    if (error) {
      error.hidden = false;
      error.textContent = t('app.evidence.what');
    }
    return;
  }
  const file = el<HTMLInputElement>('[data-evidence-file]')?.files?.[0];
  let dataB64: string | undefined;
  let fileName: string | undefined;
  if (file) {
    if (file.size > MAX_FILE_BYTES) {
      if (error) {
        error.hidden = false;
        error.textContent = `${t('app.evidence.tooBig')} (${formatBytes(file.size)})`;
      }
      return;
    }
    const bytes = new Uint8Array(await file.arrayBuffer());
    dataB64 = toBase64(bytes);
    fileName = file.name;
  }
  addEvidence(doc, {
    id: `e-${Date.now()}`,
    at: String(data.get('at') ?? new Date().toISOString().slice(0, 10)),
    kind: String(data.get('kind') ?? 'incident') as EvidenceKind,
    description,
    by: session.memberId,
    ...(dataB64 ? { dataB64 } : {}),
    ...(fileName ? { fileName } : {}),
  });
  await session.save();
  form.reset();
  if (error) error.hidden = true;
  render();
});

function toBase64(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

el<HTMLButtonElement>('[data-evidence-download-timeline]')?.addEventListener('click', () => {
  if (!doc) return;
  download('evidence-timeline.txt', evidenceTimeline(lockerItems(doc)), 'text/plain;charset=utf-8');
});

el<HTMLButtonElement>('[data-evidence-download-csv]')?.addEventListener('click', () => {
  if (!doc) return;
  download('evidence.csv', evidenceCsv(lockerItems(doc)), 'text/csv;charset=utf-8');
});

withSession(async (open) => {
  session = open;
  doc = open.doc;
  const date = el<HTMLInputElement>('[data-evidence-form] input[name="at"]');
  if (date && !date.value) date.value = new Date().toISOString().slice(0, 10);
  render();
  onDocChange(doc, render);
});
