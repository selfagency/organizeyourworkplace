/**
 * The rules the service worker decides by, out on their own so a test can
 * call them.
 *
 * The worker serves a file it was handed by the app (a file the app checked
 * against the signed release) or it does not answer at all. A worker that
 * fetched whatever the server sent and kept it would be the hole this whole
 * setup exists to close.
 */

/** The paths the worker holds a copy of. The app, in either language, plus the chunks. */
export function handles(urlPath) {
  return (
    urlPath.startsWith('/app/') ||
    urlPath.startsWith('/es/app/') ||
    urlPath.startsWith('/_astro/') ||
    urlPath === '/app-sw.js'
  );
}

/**
 * The cache keys to try for one request, in order. A page lives at
 * /app/today/index.html but the browser asks for /app/today, so both forms
 * are tried. Asset paths carry an extension, and for those there is only
 * one form.
 */
export function cacheKeysFor(pathname) {
  const tries = [pathname];
  const last = pathname.slice(pathname.lastIndexOf('/') + 1);
  if (last && !last.includes('.')) tries.push(`${pathname}/index.html`);
  return tries;
}