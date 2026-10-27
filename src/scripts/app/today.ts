/**
 * Screen 1: Today.
 *
 * The headline is the number of coworkers nobody has talked to, because
 * that is the number a committee can act on. The meter says where the
 * support is, in words as well as a bar.
 */
import { appCatalogs, type AppStringKey } from '../../i18n/app';
import { onDocChange } from '../../lib/workspace/app-state';
import { dueFollowUps, expectedSize, notTalked, people, support, supportTrend } from '../../lib/workspace/view';
import { el, lang, todayIso, withSession } from './shared';
import type * as Y from 'yjs';

const t = (key: AppStringKey): string => appCatalogs[lang()][key];

let doc: Y.Doc | null = null;

function renderEmpty(container: HTMLElement, title: string, body: string): void {
  container.textContent = '';
  const box = document.createElement('div');
  box.className = 'state well--empty';
  const heading = document.createElement('p');
  heading.className = 'state__title';
  heading.textContent = title;
  const paragraph = document.createElement('p');
  paragraph.className = 'state__body';
  paragraph.textContent = body;
  box.append(heading, paragraph);
  container.append(box);
}

function render(): void {
  if (!doc) return;
  const all = people(doc);

  const headline = el<HTMLElement>('[data-not-talked]');
  const note = el<HTMLElement>('[data-not-talked-note]');
  const untouched = notTalked(doc);
  if (headline) headline.textContent = String(untouched.length);
  if (note) {
    note.textContent =
      untouched.length === 0
        ? t('app.today.notTalkedEmpty')
        : untouched
            .slice(0, 3)
            .map((person) => person.displayName)
            .join(', ');
  }

  const unit = expectedSize(doc);
  const current = support(doc, unit);
  const percent = Math.round(current.pct * 100);
  const nowLabel = el<HTMLElement>('[data-support-now]');
  const countLabel = el<HTMLElement>('[data-support-count]');
  const fill = el<HTMLElement>('[data-meter-fill]');
  if (nowLabel) nowLabel.textContent = `${percent}% ${t('app.today.now')}`;
  if (countLabel) countLabel.textContent = `${current.supporters} of ${unit}`;
  if (fill) {
    fill.style.width = `${Math.min(100, percent)}%`;
    fill.classList.toggle('meter__fill--red', percent >= 70);
  }

  const followUps = el<HTMLElement>('[data-follow-ups]');
  if (followUps) {
    const due = dueFollowUps(doc, todayIso());
    if (all.length === 0) {
      renderEmpty(followUps, t('app.today.emptyTitle'), t('app.today.emptyBody'));
    } else if (due.length === 0) {
      followUps.textContent = t('app.today.followUpsEmpty');
    } else {
      const list = document.createElement('ul');
      list.className = 'dot-list';
      for (const item of due) {
        const row = document.createElement('li');
        const link = document.createElement('a');
        link.className = 'dot-list__row';
        link.href = `${lang() === 'es' ? '/es' : ''}/app/coworker?id=${encodeURIComponent(item.coworkerId)}`;
        const name = document.createElement('span');
        name.className = 'dot-list__name';
        name.textContent = item.name;
        const meta = document.createElement('span');
        meta.className = 'dot-list__meta';
        meta.textContent = item.text;
        link.append(name, meta);
        row.append(link);
        list.append(row);
      }
      followUps.replaceChildren(list);
    }
  }

  const trend = el<HTMLElement>('[data-trend]');
  if (trend) {
    const points = supportTrend(doc, new Date(), 4);
    const rated = points.some((point) => point.rated > 0);
    if (!rated) {
      renderEmpty(trend, t('app.today.trend'), t('app.today.trendEmpty'));
    } else {
      const list = document.createElement('ul');
      list.className = 'dot-list';
      for (const point of points) {
        const row = document.createElement('li');
        row.className = 'dot-list__row';
        const when = document.createElement('span');
        when.className = 'dot-list__name';
        when.textContent = t('app.today.week').replace('{date}', point.week);
        const count = document.createElement('span');
        count.className = 'dot-list__meta';
        count.textContent = `${point.supporters} / ${point.rated}`;
        row.append(when, count);
        list.append(row);
      }
      trend.replaceChildren(list);
    }
  }
}

withSession(async (session) => {
  doc = session.doc;
  render();
  onDocChange(session.doc, render);
});
