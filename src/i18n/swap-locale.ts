export type Locale = 'en' | 'es';

/**
 * Return the same page in the other locale.
 * English is unprefixed; Spanish lives under /es/.
 */
export function swapLocale(pathname: string, to: Locale): string {
  // Strip an existing /es prefix (only at the start of the path).
  const stripped = pathname.replace(/^\/es(?=\/|$)/, '') || '/';
  if (to === 'es') {
    return stripped === '/' ? '/es/' : `/es${stripped}`;
  }
  return stripped;
}