/**
 * Screen 6: Social groups.
 *
 * Organizing spreads through lunch tables, not departments. Each group
 * shows who is in it and who leads it.
 */
import { appCatalogs, type AppStringKey } from '../../i18n/app';
import { onDocChange } from '../../lib/workspace/app-state';
import { groupCards } from '../../lib/workspace/view';
import { el, lang, withSession } from './shared';
import type * as Y from 'yjs';

const t = (key: AppStringKey): string => appCatalogs[lang()][key];

let doc: Y.Doc | null = null;

function render(): void {
  const container = el<HTMLElement>('[data-groups-body]');
  if (!container || !doc) return;
  const cards = groupCards(doc);

  if (cards.length === 0) {
    const box = document.createElement('div');
    box.className = 'state well--empty';
    const title = document.createElement('p');
    title.className = 'state__title';
    title.textContent = t('app.groups.emptyTitle');
    const body = document.createElement('p');
    body.className = 'state__body';
    body.textContent = t('app.groups.emptyBody');
    box.append(title, body);
    container.replaceChildren(box);
    return;
  }

  const parts: Node[] = [];
  for (const card of cards) {
    const box = document.createElement('div');
    box.className = 'well';
    const head = document.createElement('p');
    head.className = 'well__title';
    head.textContent = card.label;
    const leader = document.createElement('p');
    leader.className = 'well__body';
    leader.textContent = card.leaderName
      ? `${t('app.groups.leader')}: ${card.leaderName}`
      : t('app.groups.noLeader');
    const count = document.createElement('p');
    count.className = 'well__body';
    count.textContent = t('app.groups.members').replace('{count}', String(card.members.length));
    box.append(head, leader, count);
    if (card.members.length > 0) {
      const list = document.createElement('ul');
      list.className = 'dot-list';
      for (const person of card.members) {
        const item = document.createElement('li');
        const link = document.createElement('a');
        link.className = 'dot-list__row';
        link.href = `${lang() === 'es' ? '/es' : ''}/app/coworker?id=${encodeURIComponent(person.id)}`;
        const name = document.createElement('span');
        name.className = 'dot-list__name';
        name.textContent = person.displayName;
        link.append(name);
        item.append(link);
        list.append(item);
      }
      box.append(list);
    }
    parts.push(box);
  }
  container.replaceChildren(...parts);
}

withSession(async (session) => {
  doc = session.doc;
  render();
  onDocChange(session.doc, render);
});
