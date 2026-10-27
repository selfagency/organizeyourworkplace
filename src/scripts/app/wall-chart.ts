/**
 * Screen 2: Wall chart.
 *
 * Three views over the same list: a grid by department and shift, an
 * explorer by department, and the four week trend. A dot is a person, and
 * the number on the dot is the rating, so the color never carries the
 * meaning on its own.
 */
import { appCatalogs, type AppStringKey } from '../../i18n/app';
import { onDocChange } from '../../lib/workspace/app-state';
import {
  filterPeople,
  people,
  supportTrend,
  wallRows,
  type PersonView,
  type WallFilter,
} from '../../lib/workspace/view';
import { all, el, lang, withSession } from './shared';
import type * as Y from 'yjs';

const t = (key: AppStringKey): string => appCatalogs[lang()][key];

let doc: Y.Doc | null = null;
let view: 'grid' | 'explorer' | 'trend' = 'grid';
let filter: WallFilter | null = null;

function personPath(id: string): string {
  return `${lang() === 'es' ? '/es' : ''}/app/coworker?id=${encodeURIComponent(id)}`;
}

function dot(person: PersonView): HTMLAnchorElement {
  const link = document.createElement('a');
  link.className = person.rating ? `wall-dot wall-dot--${person.rating}` : 'wall-dot wall-dot--none';
  link.href = personPath(person.id);
  link.title = `${person.displayName}: ${person.rating ? t(`app.rating.${person.rating}` as 'app.rating.1') : t('app.wall.unrated')}`;
  link.textContent = person.rating ? String(person.rating) : '–';
  link.setAttribute('aria-label', link.title);
  return link;
}

function renderGrid(container: HTMLElement, all_people: PersonView[]): void {
  const rows = wallRows(doc!);
  const activeFilter = filter;
  const grid = document.createElement('div');
  grid.className = 'wall-grid';
  let shown = 0;
  for (const row of rows) {
    const peopleInRow = activeFilter
      ? row.people.filter((person) => filterPeople([person], activeFilter, new Date()).length > 0)
      : row.people;
    if (peopleInRow.length === 0) continue;
    shown += peopleInRow.length;
    const box = document.createElement('div');
    box.className = 'wall-grid__row';
    const head = document.createElement('div');
    head.className = 'wall-grid__head';
    const dept = document.createElement('span');
    dept.textContent = row.dept || t('app.wall.department');
    const shift = document.createElement('span');
    shift.textContent = row.shift || t('app.wall.shift');
    head.append(dept, shift);
    const dots = document.createElement('div');
    dots.className = 'wall-grid__dots';
    for (const person of peopleInRow) dots.append(dot(person));
    box.append(head, dots);
    grid.append(box);
  }
  container.replaceChildren(grid);
  if (shown === 0) {
    const empty = document.createElement('div');
    empty.className = 'state well--empty';
    const title = document.createElement('p');
    title.className = 'state__title';
    title.textContent = all_people.length === 0 ? t('app.wall.emptyTitle') : t('app.wall.filter.unassigned');
    const body = document.createElement('p');
    body.className = 'state__body';
    body.textContent = all_people.length === 0 ? t('app.wall.emptyBody') : t('app.wall.count').replace('{count}', '0');
    empty.append(title, body);
    container.append(empty);
  }
}

function renderExplorer(container: HTMLElement, all_people: PersonView[]): void {
  const byDepartment = new Map<string, PersonView[]>();
  for (const person of all_people) {
    const key = person.dept || t('app.wall.department');
    byDepartment.set(key, [...(byDepartment.get(key) ?? []), person]);
  }
  const list = document.createElement('div');
  list.className = 'wall-grid';
  for (const [dept, members] of byDepartment) {
    const box = document.createElement('div');
    box.className = 'wall-grid__row';
    const head = document.createElement('div');
    head.className = 'wall-grid__head';
    const name = document.createElement('span');
    name.textContent = dept;
    const count = document.createElement('span');
    count.textContent = t('app.wall.count').replace('{count}', String(members.length));
    head.append(name, count);
    const dots = document.createElement('div');
    dots.className = 'wall-grid__dots';
    for (const person of members) dots.append(dot(person));
    box.append(head, dots);
    list.append(box);
  }
  container.replaceChildren(list);
  if (all_people.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'state well--empty';
    const title = document.createElement('p');
    title.className = 'state__title';
    title.textContent = t('app.wall.emptyTitle');
    const body = document.createElement('p');
    body.className = 'state__body';
    body.textContent = t('app.wall.emptyBody');
    empty.append(title, body);
    container.append(empty);
  }
}

function renderTrend(container: HTMLElement): void {
  const points = supportTrend(doc!, new Date(), 4);
  const list = document.createElement('ul');
  list.className = 'dot-list';
  const peak = Math.max(1, ...points.map((point) => point.rated));
  for (const point of points) {
    const row = document.createElement('li');
    row.className = 'dot-list__row';
    const when = document.createElement('span');
    when.className = 'dot-list__name';
    when.textContent = point.week;
    const meter = document.createElement('span');
    meter.className = 'meter';
    meter.style.width = '100%';
    const fill = document.createElement('span');
    fill.className = 'meter__fill';
    fill.style.width = `${Math.round((point.rated / peak) * 100)}%`;
    meter.append(fill);
    const count = document.createElement('span');
    count.className = 'dot-list__meta';
    count.textContent = `${point.supporters} / ${point.rated}`;
    row.append(when, meter, count);
    list.append(row);
  }
  container.replaceChildren(list);
}

function render(): void {
  if (!doc) return;
  const container = el<HTMLElement>('[data-wall-body]');
  if (!container) return;
  const all_people = people(doc);
  const shown = filter ? filterPeople(all_people, filter, new Date()) : all_people;
  if (view === 'grid') renderGrid(container, all_people);
  else if (view === 'explorer') renderExplorer(container, shown);
  else renderTrend(container);
}

for (const tab of all<HTMLButtonElement>('[data-wall-views] [data-view]')) {
  tab.addEventListener('click', () => {
    view = (tab.dataset.view as typeof view) ?? 'grid';
    for (const other of all<HTMLButtonElement>('[data-wall-views] [data-view]')) {
      other.setAttribute('aria-selected', String(other === tab));
    }
    render();
  });
}

for (const chip of all<HTMLButtonElement>('[data-wall-filters] [data-filter]')) {
  chip.addEventListener('click', () => {
    const name = chip.dataset.filter as WallFilter;
    filter = filter === name ? null : name;
    for (const other of all<HTMLButtonElement>('[data-wall-filters] [data-filter]')) {
      other.setAttribute('aria-pressed', String(other.dataset.filter === filter));
    }
    render();
  });
}

withSession(async (session) => {
  doc = session.doc;
  render();
  onDocChange(session.doc, render);
});
