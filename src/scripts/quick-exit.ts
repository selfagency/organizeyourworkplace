import { QUICK_EXIT_URL } from '../config';
import { isDoublePress } from './lib/keys';

function exit(): void {
  // location.replace: Back must not return here (01-content.md §Global chrome).
  location.replace(QUICK_EXIT_URL);
}

let lastEsc: number | null = null;

document.addEventListener('keydown', (event) => {
  if (event.key !== 'Escape') return;
  const now = Date.now();
  if (isDoublePress(now, lastEsc)) {
    exit();
    return;
  }
  lastEsc = now;
});

const button = document.querySelector<HTMLElement>('[data-quick-exit]');
button?.addEventListener('click', exit);