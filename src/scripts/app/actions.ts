/**
 * Screen 8: Actions.
 *
 * A petition, a march, a button day. Each one has a role, a number of
 * people to reach, and a date. The escalation ladder from Labor Notes:
 * start with the easy ask.
 */
import { appCatalogs, type AppStringKey } from '../../i18n/app';
import { onDocChange, type Session } from '../../lib/workspace/app-state';
import { addAction, type ActionTemplate } from '../../lib/workspace/model';
import { actions } from '../../lib/workspace/view';
import { el, lang, withSession } from './shared';
import type * as Y from 'yjs';

const t = (key: AppStringKey): string => appCatalogs[lang()][key];

let session: Session | null = null;
let doc: Y.Doc | null = null;

const TEMPLATE_KEYS: Record<ActionTemplate, AppStringKey> = {
  petition: 'app.actions.petition',
  march: 'app.actions.march',
  button_day: 'app.actions.buttonDay',
  other: 'app.actions.other',
};

function render(): void {
  const container = el<HTMLElement>('[data-actions-body]');
  if (!container || !doc) return;
  const list = actions(doc);

  if (list.length === 0) {
    const box = document.createElement('div');
    box.className = 'state well--empty';
    const title = document.createElement('p');
    title.className = 'state__title';
    title.textContent = t('app.actions.emptyTitle');
    const body = document.createElement('p');
    body.className = 'state__body';
    body.textContent = t('app.actions.emptyBody');
    box.append(title, body);
    container.replaceChildren(box);
    return;
  }

  const items = document.createElement('ul');
  items.className = 'dot-list';
  for (const action of list) {
    const item = document.createElement('li');
    item.className = 'dot-list__row';
    const name = document.createElement('span');
    name.className = 'dot-list__name';
    name.textContent = action.title;
    const meta = document.createElement('span');
    meta.className = 'dot-list__meta';
    meta.textContent = `${action.date} · ${t('app.actions.goalLine').replace('{goal}', String(action.goal))}`;
    item.append(name, meta);
    const wrap = document.createElement('div');
    const stamp = document.createElement('p');
    stamp.className = 'state__body';
    const parts = [t(TEMPLATE_KEYS[action.template])];
    if (action.roles.length > 0) parts.push(action.roles.join(', '));
    stamp.textContent = parts.join(' · ');
    wrap.append(item, stamp);
    items.append(wrap);
  }
  container.replaceChildren(items);
}

el<HTMLFormElement>('[data-action-form]')?.addEventListener('submit', async (event) => {
  event.preventDefault();
  if (!session || !doc) return;
  const form = event.currentTarget as HTMLFormElement;
  const data = new FormData(form);
  const title = String(data.get('title') ?? '').trim();
  if (!title) return;
  const roles = String(data.get('roles') ?? '')
    .split(',')
    .map((role) => role.trim())
    .filter(Boolean);
  addAction(doc, {
    id: `a-${Date.now()}`,
    template: String(data.get('template') ?? 'other') as ActionTemplate,
    title,
    roles,
    goal: Number(data.get('goal') ?? 0),
    date: String(data.get('date') ?? ''),
  });
  await session.save();
  form.reset();
  render();
});

withSession(async (open) => {
  session = open;
  doc = open.doc;
  render();
  onDocChange(doc, render);
});
