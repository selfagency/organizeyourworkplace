/**
 * Screen 5: Leaders and coverage.
 *
 * Who talks to whom, and who is carrying too much. A leader with more
 * than ten people under them gets flagged, because that is how a drive
 * quietly stalls.
 */
import { appCatalogs, type AppStringKey } from '../../i18n/app';
import { onDocChange } from '../../lib/workspace/app-state';
import { leaderTree, people } from '../../lib/workspace/view';
import { el, lang, withSession } from './shared';
import type * as Y from 'yjs';

const t = (key: AppStringKey): string => appCatalogs[lang()][key];

let doc: Y.Doc | null = null;

function personLink(id: string, name: string): HTMLAnchorElement {
  const link = document.createElement('a');
  link.className = 'dot-list__row';
  link.href = `${lang() === 'es' ? '/es' : ''}/app/coworker?id=${encodeURIComponent(id)}`;
  const label = document.createElement('span');
  label.className = 'dot-list__name';
  label.textContent = name;
  link.append(label);
  return link;
}

function render(): void {
  const container = el<HTMLElement>('[data-leaders-body]');
  if (!container || !doc) return;
  const nodes = leaderTree(doc);
  const all = people(doc);
  const covered = new Set(nodes.flatMap((node) => node.covers.map((person) => person.id)));
  const uncovered = all.filter((person) => !covered.has(person.id));

  if (nodes.length === 0 && uncovered.length === 0) {
    const box = document.createElement('div');
    box.className = 'state well--empty';
    const title = document.createElement('p');
    title.className = 'state__title';
    title.textContent = t('app.leaders.emptyTitle');
    const body = document.createElement('p');
    body.className = 'state__body';
    body.textContent = t('app.leaders.emptyBody');
    box.append(title, body);
    container.replaceChildren(box);
    return;
  }

  const parts: Node[] = [];
  for (const node of nodes) {
    const box = document.createElement('div');
    box.className = 'well';
    const head = document.createElement('p');
    head.className = 'well__title';
    head.textContent = node.leaderName;
    const count = document.createElement('p');
    count.className = 'well__body';
    count.textContent = t('app.leaders.covers').replace('{count}', String(node.covers.length));
    box.append(head, count);
    if (node.overworked) {
      const flag = document.createElement('p');
      flag.className = 'stamp stamp--red';
      flag.textContent = t('app.leaders.over');
      box.append(flag);
    }
    const list = document.createElement('ul');
    list.className = 'dot-list';
    for (const person of node.covers) {
      const item = document.createElement('li');
      item.append(personLink(person.id, person.displayName));
      list.append(item);
    }
    box.append(list);
    parts.push(box);
  }

  if (uncovered.length > 0) {
    const section = document.createElement('section');
    const heading = document.createElement('h2');
    heading.textContent = t('app.leaders.unassigned');
    const list = document.createElement('ul');
    list.className = 'dot-list';
    for (const person of uncovered) {
      const item = document.createElement('li');
      item.append(personLink(person.id, person.displayName));
      list.append(item);
    }
    section.append(heading, list);
    parts.push(section);
  }

  container.replaceChildren(...parts);
}

withSession(async (session) => {
  doc = session.doc;
  render();
  onDocChange(session.doc, render);
});
