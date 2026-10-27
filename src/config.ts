/** Site-wide constants. Change here, not in components. */

/** The domain we treat as "ours" for the leaving-the-site warning. */
export const SITE_DOMAIN = 'organizeyourworkplace.com';

/** Where Quick Exit sends the worker. Neutral, no account needed. */
export const QUICK_EXIT_URL = 'https://www.google.com';

/**
 * The sync server this site runs, proxied at the same origin as the app
 * (see deploy/proxy: /mailbox/ and /match/ reach the sync service there).
 * Empty means "the site's own server": the app uses relative addresses,
 * which the CSP allows, and the labels never appear in a cross-origin
 * preflight. A member who hosts their own app and server already has the
 * same arrangement. Pointing the app at somebody else's origin does not
 * work under the site's CSP; that is a documented limit for self-hosters
 * who want one app talking to another host's server.
 */
export const DEFAULT_SYNC_SERVER = '';

/** The value a member types or stores to turn syncing off on this device. */
export const SYNC_OFF = 'none';