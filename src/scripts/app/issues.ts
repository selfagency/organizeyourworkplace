/**
 * Screen 7: Issues.
 *
 * What people actually raised, ranked by how many raised it, with the
 * share from each department. This is what feeds the message to the boss
 * and the bargaining survey later.
 */
import { appCatalogs, type AppStringKey } from '../../i18n/app';
import { onDocChange } from '../../lib/workspace/app-state';
import { issueRanking } from '../../lib/workspace/view';
import { el, lang, withSession } from './shared';
import type * as Y from 'yjs';

const t = (key: AppStringKey): string => appCatalogs[lang()][key];

let doc: Y.Doc | null = null;

function render(): void {
  const container = el<HTMLElement>('[data-issues-body]');
  if (!container || !doc) return;
  const ranked = issueRanking(doc);

  if (ranked.length === 0) {
    const box = document.createElement('div');
    box.className = 'state well--empty';
    const title = document.createElement('p');
    title.className = 'state__title';
    title.textContent = t('app.issues.emptyTitle');
    const body = document.createElement('p');
    body.className = 'state__body';
    body.textContent = t('app.issues.emptyBody');
    box.append(title, body);
    container.replaceChildren(box);
    return;
  }

  const list = document.createElement('ul');
  list.className = 'dot-list';
  for (const entry of ranked) {
    const item = document.createElement('li');
    item.className = 'dot-list__row';
    const name = document.createElement('span');
    name.className = 'dot-list__name';
    name.textContent = entry.issue;
    const count = document.createElement('span');
    count.className = 'dot-list__meta';
    count.textContent = t('app.issues.raisedBy').replace('{count}', String(entry.count));
    item.append(name, count);
    const share = document.createElement('p');
    share.className = 'state__body';
    share.textContent = entry.byDepartment
      .map((entry2) => `${entry2.dept}: ${entry2.count}`)
      .join(' · ');
    const row = document.createElement('div');
    row.append(item, share);
    list.append(row);
  }
  container.replaceChildren(list);
}

withSession(async (session) => {
  doc = session.doc;
  render();
  onDocChange(session.doc, render);
});
