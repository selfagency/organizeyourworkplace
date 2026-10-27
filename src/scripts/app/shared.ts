/**
 * Shared helpers for the app screens (R3.8).
 */
import { resumeSession, type Session } from '../../lib/workspace/app-state';

export type Lang = 'en' | 'es';

export function lang(): Lang {
  return document.documentElement.lang === 'es' ? 'es' : 'en';
}

export function lockPath(): string {
  return lang() === 'es' ? '/es/app/' : '/app/';
}

/**
 * Opens the workspace for this screen. When the session is gone, the member
 * goes back to the lock screen instead of seeing an empty app.
 */
export async function withSession(handler: (session: Session) => Promise<void> | void): Promise<void> {
  const session = await resumeSession();
  if (!session) {
    location.replace(lockPath());
    return;
  }
  await handler(session);
}

export function el<T extends Element>(selector: string): T | null {
  return document.querySelector<T>(selector);
}

export function all<T extends Element>(selector: string): T[] {
  return [...document.querySelectorAll<T>(selector)];
}

export function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Escapes text before it goes into the page. */
export function text(value: string): string {
  const node = document.createElement('span');
  node.textContent = value;
  return node.innerHTML;
}

/** Saves a file on the phone, without sending it anywhere. */
export function download(name: string, content: string, type: string): void {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
