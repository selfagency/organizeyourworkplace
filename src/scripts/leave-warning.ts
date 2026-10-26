import { isExternalUrl } from './lib/links';

/**
 * Leaving-the-site warning (07-stack-and-hosting.md L1–L6).
 * No server round-trip: the destination is never sent anywhere.
 */

const dialog = document.querySelector<HTMLDialogElement>('[data-leave-dialog]');

if (dialog) {
  const bodyEl = dialog.querySelector<HTMLElement>('[data-leave-body]');
  const domainEls = dialog.querySelectorAll<HTMLElement>('[data-leave-domain]');
  const intakeNote = dialog.querySelector<HTMLElement>('[data-leave-intake]');
  const goBackBtn = dialog.querySelector<HTMLButtonElement>('[data-leave-back]');
  const continueBtn = dialog.querySelector<HTMLButtonElement>('[data-leave-continue]');
  const bodyTemplate = bodyEl?.dataset.leaveBodyTemplate ?? '';
  const continueTemplate = continueBtn?.dataset.leaveContinueTemplate ?? '';

  let pendingUrl: string | null = null;
  let pendingNewTab = false;

  function open(url: URL, isIntake: boolean): void {
    pendingUrl = url.href;
    for (const el of domainEls) el.textContent = url.host;
    if (bodyEl) bodyEl.textContent = bodyTemplate.replace('{domain}', url.host);
    if (continueBtn) continueBtn.textContent = continueTemplate.replace('{domain}', url.host);
    if (intakeNote) intakeNote.hidden = !isIntake;
    dialog?.showModal();
    goBackBtn?.focus();
  }

  function continueToUrl(): void {
    if (!pendingUrl) return;
    dialog?.close();
    if (pendingNewTab) {
      window.open(pendingUrl, '_blank', 'noopener,noreferrer');
    } else {
      const anchor = document.createElement('a');
      anchor.href = pendingUrl;
      anchor.rel = 'noopener noreferrer';
      anchor.referrerPolicy = 'no-referrer';
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
    }
    pendingUrl = null;
  }

  document.addEventListener('click', (event) => {
    if (
      event.defaultPrevented ||
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey
    ) {
      return;
    }
    const anchor = (event.target as HTMLElement).closest<HTMLAnchorElement>('a[href]');
    if (!anchor) return;
    let url: URL;
    try {
      url = new URL(anchor.href, location.href);
    } catch {
      return;
    }
    if (!isExternalUrl(url, location.host)) return;
    event.preventDefault();
    pendingNewTab = anchor.target === '_blank';
    open(url, anchor.dataset.intake === 'true');
  });

  goBackBtn?.addEventListener('click', () => dialog?.close());
  continueBtn?.addEventListener('click', continueToUrl);

  // Focus trap: keep Tab inside the dialog (L4).
  dialog.addEventListener('keydown', (event) => {
    if (event.key !== 'Tab') return;
    const focusables = dialog.querySelectorAll<HTMLElement>('button, a[href]');
    if (focusables.length === 0) return;
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  });
}