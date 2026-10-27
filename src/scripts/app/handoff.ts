/**
 * Screen 11: Hand off.
 *
 * Nothing leaves the phone until a second core member approves. The app
 * says so out loud, because the drive is the one thing a committee cannot
 * get back.
 */
import { appCatalogs, type AppStringKey } from '../../i18n/app';
import { onDocChange, type Session } from '../../lib/workspace/app-state';
import { canHandOff, handoffSummary, wallChartCsv } from '../../lib/workspace/handoff';
import { memberList } from '../../lib/workspace/model';
import { el, lang, withSession } from './shared';
import type * as Y from 'yjs';

const t = (key: AppStringKey): string => appCatalogs[lang()][key];

let session: Session | null = null;
let doc: Y.Doc | null = null;
const approvals = new Set<string>();

function coreMembers(): { id: string; name: string }[] {
  if (!doc) return [];
  return memberList(doc)
    .filter((member) => member.role === 'core')
    .map((member) => ({ id: member.id, name: member.name }));
}

function renderApprovals(): void {
  const container = el<HTMLElement>('[data-handoff-approvals]');
  if (!container) return;
  const core = coreMembers();
  if (core.length === 0) {
    const note = document.createElement('p');
    note.className = 'state__body';
    note.textContent = t('app.members.none');
    container.replaceChildren(note);
    return;
  }
  const list = document.createElement('ul');
  list.className = 'dot-list';
  for (const member of core) {
    const item = document.createElement('li');
    const row = document.createElement('div');
    row.className = 'dot-list__row';
    const label = document.createElement('label');
    label.className = 'dot-list__row';
    const box = document.createElement('input');
    box.type = 'checkbox';
    box.checked = approvals.has(member.id);
    box.addEventListener('change', () => {
      if (box.checked) approvals.add(member.id);
      else approvals.delete(member.id);
      updateButton();
    });
    const name = document.createElement('span');
    name.className = 'dot-list__name';
    name.textContent = member.name;
    label.append(box, name);
    row.append(label);
    item.append(row);
    list.append(item);
  }
  container.replaceChildren(list);
  updateButton();
}

function updateButton(): void {
  const button = el<HTMLButtonElement>('[data-handoff-button]');
  const needTwo = el<HTMLElement>('[data-handoff-need-two]');
  if (!button || !session) return;
  const allowed = canHandOff([...approvals], session.memberId);
  button.setAttribute('aria-disabled', String(!allowed));
  if (needTwo) needTwo.hidden = allowed;
  if (allowed) {
    button.classList.remove('is-loading');
  }
}

function handOff(): void {
  if (!session) return;
  if (!canHandOff([...approvals], session.memberId)) {
    updateButton();
    return;
  }
  const csv = wallChartCsv(session.doc);
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'wall-chart.csv';
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);

  const output = el<HTMLElement>('[data-handoff-output]');
  const summary = el<HTMLTextAreaElement>('[data-handoff-summary]');
  if (output) output.hidden = false;
  if (summary) summary.value = handoffSummary(session.doc);
  output?.scrollIntoView({ block: 'start' });
}

el<HTMLButtonElement>('[data-handoff-button]')?.addEventListener('click', handOff);

el<HTMLButtonElement>('[data-handoff-copy-summary]')?.addEventListener('click', async () => {
  const summary = el<HTMLTextAreaElement>('[data-handoff-summary]');
  if (!summary) return;
  try {
    await navigator.clipboard.writeText(summary.value);
  } catch {
    summary.select();
  }
});

withSession(async (open) => {
  session = open;
  doc = open.doc;
  renderApprovals();
  onDocChange(doc, renderApprovals);
});
