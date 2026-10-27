/**
 * Screen 3: the coworker card.
 *
 * Everything the committee knows about one person, in the order a
 * one-on-one needs it: where they are now, how it changed, what came up,
 * and what happens next.
 */
import { appCatalogs, type AppStringKey } from '../../i18n/app';
import { onDocChange, type Session } from '../../lib/workspace/app-state';
import { conversations, people } from '../../lib/workspace/view';
import { el, lang, withSession } from './shared';
import { openLogSheet } from './log';

const t = (key: AppStringKey): string => appCatalogs[lang()][key];

let session: Session | null = null;

function ratingChip(rating: number): HTMLElement {
  const chip = document.createElement('span');
  chip.className = `rating rating--${rating}`;
  const number = document.createElement('span');
  number.className = 'rating__number';
  number.textContent = String(rating);
  const word = document.createElement('span');
  word.textContent = t(`app.rating.${rating}` as 'app.rating.1');
  chip.append(number, word);
  return chip;
}

function section(title: string, body: Node | null, empty: string): HTMLElement {
  const wrapper = document.createElement('section');
  const heading = document.createElement('h2');
  heading.textContent = title;
  wrapper.append(heading);
  if (body) {
    wrapper.append(body);
  } else {
    const note = document.createElement('p');
    note.className = 'state__body';
    note.textContent = empty;
    wrapper.append(note);
  }
  return wrapper;
}

function render(): void {
  const container = el<HTMLElement>('[data-person-body]');
  if (!container || !session) return;
  const id = new URLSearchParams(location.search).get('id') ?? '';
  const person = people(session.doc).find((entry) => entry.id === id);
  if (!person) {
    const box = document.createElement('div');
    box.className = 'state state--error';
    const title = document.createElement('p');
    title.className = 'state__title';
    title.textContent = t('app.person.notFound');
    const back = document.createElement('a');
    back.className = 'button button--block';
    back.href = `${lang() === 'es' ? '/es' : ''}/app/wall-chart`;
    back.textContent = t('app.person.back');
    box.append(title, back);
    container.replaceChildren(box);
    return;
  }

  const parts: Node[] = [];

  const head = document.createElement('div');
  const name = document.createElement('p');
  name.className = 'poster-block__value';
  name.style.fontSize = 'var(--text-2xl)';
  name.textContent = person.displayName;
  const meta = document.createElement('p');
  meta.className = 'poster-block__note';
  meta.style.color = 'var(--muted)';
  const bits = [person.dept, person.shift, person.language].filter(Boolean);
  meta.textContent = bits.join(' · ');
  head.append(name, meta);
  parts.push(head);

  const rating = document.createElement('p');
  rating.append(ratingChip(person.rating ?? 3));
  parts.push(section(t('app.person.rating'), rating, t('app.person.noHistory')));

  if (person.ratingHistory.length > 0) {
    const list = document.createElement('ul');
    list.className = 'timeline';
    for (const entry of person.ratingHistory.slice().reverse()) {
      const item = document.createElement('li');
      item.className = 'timeline__item';
      const when = document.createElement('p');
      when.className = 'timeline__when';
      when.textContent = entry.at.slice(0, 10);
      const what = document.createElement('p');
      what.className = 'timeline__what';
      what.textContent = `${entry.rating} · ${t(`app.rating.${entry.rating}` as 'app.rating.1')}`;
      item.append(when, what);
      list.append(item);
    }
    parts.push(section(t('app.person.history'), list, t('app.person.noHistory')));
  }

  if (person.issues.length > 0) {
    const list = document.createElement('ul');
    list.className = 'dot-list';
    for (const issue of person.issues) {
      const row = document.createElement('li');
      row.className = 'dot-list__row';
      row.textContent = issue;
      list.append(row);
    }
    parts.push(section(t('app.person.issues'), list, t('app.person.noIssues')));
  }

  if (person.groups.length > 0) {
    const list = document.createElement('ul');
    list.className = 'dot-list';
    for (const group of person.groups) {
      const row = document.createElement('li');
      row.className = 'dot-list__row';
      row.textContent = group;
      list.append(row);
    }
    parts.push(section(t('app.person.groups'), list, t('app.person.noGroups')));
  }

  if (person.pointPerson) {
    const text = document.createElement('p');
    text.textContent = person.pointPerson;
    parts.push(section(t('app.person.pointPerson'), text, t('app.person.noPointPerson')));
  }

  if (person.nextStep) {
    const box = document.createElement('div');
    box.className = 'well';
    const what = document.createElement('p');
    what.className = 'well__title';
    what.textContent = person.nextStep.text;
    const due = document.createElement('p');
    due.className = 'well__body';
    due.textContent = t('app.person.due').replace('{date}', person.nextStep.due);
    box.append(what, due);
    parts.push(section(t('app.person.nextStep'), box, t('app.person.noHistory')));
  }

  const talks = conversations(session.doc).filter((entry) => entry.coworker === person.id);
  if (talks.length > 0) {
    const list = document.createElement('ul');
    list.className = 'timeline';
    for (const talk of talks) {
      const item = document.createElement('li');
      item.className = 'timeline__item';
      const when = document.createElement('p');
      when.className = 'timeline__when';
      when.textContent = talk.at.slice(0, 10);
      const what = document.createElement('p');
      what.className = 'timeline__what';
      what.textContent = `${talk.from ?? '–'} → ${talk.to}`;
      item.append(when, what);
      if (talk.note) {
        const note = document.createElement('p');
        note.textContent = talk.note;
        item.append(note);
      }
      list.append(item);
    }
    parts.push(section(t('app.person.timeline'), list, t('app.person.noHistory')));
  }

  const logButton = document.createElement('button');
  logButton.className = 'button button--primary button--block';
  logButton.type = 'button';
  logButton.textContent = t('app.log.title');
  logButton.addEventListener('click', () => openLogSheet(person.id));
  parts.push(logButton);

  container.replaceChildren(...parts);
}

withSession(async (open) => {
  session = open;
  render();
  onDocChange(session.doc, render);
});
