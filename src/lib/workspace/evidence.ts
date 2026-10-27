/**
 * Screen 9: the shared evidence locker.
 *
 * Incidents, photos, schedules, pay stubs. Everything is inside the
 * encrypted room, so the server never sees a photo of a pay stub.
 *
 * The export is the timeline a lawyer or a worker center needs: dates in
 * order, what happened, and who put it in.
 */
import type * as Y from 'yjs';

import { evidenceList, type EvidenceKind, type EvidenceItem } from './model';

/** A photo bigger than this is a video, not evidence. */
export const MAX_FILE_BYTES = 2 * 1024 * 1024;

export const EVIDENCE_KINDS: EvidenceKind[] = [
  'incident',
  'photo',
  'schedule',
  'pay_stub',
  'other',
];

export const KIND_LABELS: Record<EvidenceKind, { en: string; es: string }> = {
  incident: { en: 'Incident', es: 'Incidente' },
  photo: { en: 'Photo', es: 'Foto' },
  schedule: { en: 'Schedule', es: 'Horario' },
  pay_stub: { en: 'Pay stub', es: 'Recibo de pago' },
  other: { en: 'Other', es: 'Otra cosa' },
};

/**
 * The timeline, plain text, oldest first. The dates come first because
 * that is what a timeline is.
 */
export function evidenceTimeline(items: EvidenceItem[]): string {
  const lines = items.map((item) => {
    const kind = KIND_LABELS[item.kind][item.kind === 'pay_stub' ? 'en' : 'en'];
    const file = item.fileName ? ` (file: ${item.fileName})` : '';
    return `${item.at}  ${kind}: ${item.description}${file}  [added by ${item.by}]`;
  });
  return lines.length > 0 ? lines.join('\n') + '\n' : '';
}

/** The same timeline as a CSV, for a case file. */
export function evidenceCsv(items: EvidenceItem[]): string {
  const cell = (value: string) => (/[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value);
  const rows = items.map((item) =>
    [item.at, KIND_LABELS[item.kind].en, item.description, item.fileName ?? '', item.by]
      .map(cell)
      .join(','),
  );
  return `\uFEFFDate,Kind,What happened,File,Added by\n${rows.join('\n')}\n`;
}

/** The locker, in the order the timeline uses. */
export function lockerItems(doc: Y.Doc): EvidenceItem[] {
  return evidenceList(doc);
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
