/**
 * Screen 4: Log a conversation.
 *
 * Four taps: who, where they are now, the issues, the next step. The sheet
 * is the same code whether it opens from the wall chart or from the Log
 * tab.
 */
import { appCatalogs, type AppStringKey } from '../../i18n/app';
import { onDocChange, type Session } from '../../lib/workspace/app-state';
import { addConversation, setNextStep, setRating, type Rating } from '../../lib/workspace/model';
import { people, type PersonView } from '../../lib/workspace/view';
import { all, el, lang, withSession } from './shared';

const t = (key: AppStringKey): string => appCatalogs[lang()][key];

let session: Session | null = null;
let chosenRating: Rating | null = null;

function peopleOptions(selected?: string): HTMLOptionElement[] {
  if (!session) return [];
  return people(session.doc).map((person) => {
    const option = document.createElement('option');
    option.value = person.id;
    option.textContent = person.displayName;
    if (person.id === selected) option.selected = true;
    return option;
  });
}

function fillWho(selected?: string): void {
  const select = el<HTMLSelectElement>('[data-log-who]');
  if (!select) return;
  const placeholder = select.options[0];
  select.replaceChildren(...(placeholder ? [placeholder] : []), ...peopleOptions(selected));
}

function currentRatingOf(personId: string): Rating | null {
  if (!session) return null;
  const person = people(session.doc).find((entry) => entry.id === personId);
  return person?.rating ?? null;
}

function showFrom(personId: string): void {
  const field = el<HTMLElement>('[data-log-from-field]');
  const box = el<HTMLElement>('[data-log-from]');
  if (!field || !box) return;
  const rating = currentRatingOf(personId);
  field.hidden = rating === null;
  if (rating === null) return;
  const person = people(session!.doc).find((entry) => entry.id === personId) as PersonView;
  const chip = document.createElement('span');
  chip.className = `rating rating--${rating}`;
  const number = document.createElement('span');
  number.className = 'rating__number';
  number.textContent = String(rating);
  const word = document.createElement('span');
  word.textContent = t(`app.rating.${rating}` as 'app.rating.1');
  chip.append(number, word);
  const who = document.createElement('span');
  who.textContent = ` ${person.displayName}`;
  box.replaceChildren(chip, who);
}

/** Opens the sheet, with a person already picked when there is one. */
export function openLogSheet(personId?: string): void {
  const sheet = el<HTMLElement>('[data-log-sheet]');
  if (!sheet) return;
  fillWho(personId);
  const date = el<HTMLInputElement>('[data-log-date]');
  if (date && !date.value) date.value = new Date().toISOString().slice(0, 10);
  chosenRating = null;
  for (const chip of all<HTMLButtonElement>('[data-log-ratings] [data-rating]')) {
    chip.setAttribute('aria-pressed', 'false');
  }
  for (const tag of all<HTMLButtonElement>('[data-log-issues] [data-issue]')) {
    tag.setAttribute('aria-pressed', 'false');
  }
  const note = el<HTMLTextAreaElement>('[data-log-note]');
  if (note) note.value = '';
  const next = el<HTMLInputElement>('[data-log-next]');
  if (next) next.value = '';
  const error = el<HTMLElement>('[data-log-error]');
  if (error) error.hidden = true;
  if (personId) showFrom(personId);
  sheet.hidden = false;
  const who = el<HTMLSelectElement>('[data-log-who]');
  who?.focus();
}

function closeSheet(): void {
  const sheet = el<HTMLElement>('[data-log-sheet]');
  if (sheet) sheet.hidden = true;
}

el<HTMLButtonElement>('[data-log-close]')?.addEventListener('click', closeSheet);
document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') closeSheet();
});

el<HTMLSelectElement>('[data-log-who]')?.addEventListener('change', (event) => {
  const select = event.currentTarget as HTMLSelectElement;
  if (select.value) showFrom(select.value);
});

for (const chip of all<HTMLButtonElement>('[data-log-ratings] [data-rating]')) {
  chip.addEventListener('click', () => {
    chosenRating = Number(chip.dataset.rating) as Rating;
    for (const other of all<HTMLButtonElement>('[data-log-ratings] [data-rating]')) {
      other.setAttribute('aria-pressed', String(other === chip));
    }
  });
}

for (const tag of all<HTMLButtonElement>('[data-log-issues] [data-issue]')) {
  tag.addEventListener('click', () => {
    const pressed = tag.getAttribute('aria-pressed') === 'true';
    tag.setAttribute('aria-pressed', String(!pressed));
  });
}

el<HTMLFormElement>('[data-log-form]')?.addEventListener('submit', async (event) => {
  event.preventDefault();
  if (!session) return;
  const form = event.currentTarget as HTMLFormElement;
  const data = new FormData(form);
  const coworker = String(data.get('coworker') ?? '');
  const error = el<HTMLElement>('[data-log-error]');
  if (!coworker) {
    if (error) {
      error.hidden = false;
      error.textContent = t('app.log.needWho');
    }
    el<HTMLSelectElement>('[data-log-who]')?.setAttribute('aria-invalid', 'true');
    el<HTMLSelectElement>('[data-log-who]')?.focus();
    return;
  }
  if (chosenRating === null) {
    if (error) {
      error.hidden = false;
      error.textContent = t('app.log.needRating');
    }
    return;
  }
  const at = String(data.get('at') ?? new Date().toISOString().slice(0, 10));
  const note = String(data.get('note') ?? '').trim();
  const nextStep = String(data.get('nextStep') ?? '').trim();
  const issues = all<HTMLButtonElement>('[data-log-issues] [data-issue]')
    .filter((tag) => tag.getAttribute('aria-pressed') === 'true')
    .map((tag) => tag.dataset.issue ?? '');

  const previous = currentRatingOf(coworker);
  setRating(session.doc, coworker, chosenRating, at, session.memberId);
  addConversation(session.doc, {
    id: `cv-${Date.now()}`,
    coworker,
    by: session.memberId,
    at,
    ...(previous ? { from: previous } : {}),
    to: chosenRating,
    issues,
    ...(note ? { note } : {}),
    ...(nextStep ? { nextStep } : {}),
  });
  if (nextStep) {
    setNextStep(session.doc, coworker, { text: nextStep, due: at });
  }
  await session.save();
  closeSheet();
});

withSession(async (open) => {
  session = open;
  fillWho();
  onDocChange(session.doc, () => fillWho());
  if (el<HTMLElement>('[data-log-sheet]')?.hidden === false) {
    // The Log tab opens the sheet straight away.
    openLogSheet();
  }
});
