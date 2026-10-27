/** Site-wide constants. Change here, not in components. */

/** The domain we treat as "ours" for the leaving-the-site warning. */
export const SITE_DOMAIN = 'organizeyourworkplace.com';

/** Where Quick Exit sends the worker. Neutral, no account needed. */
export const QUICK_EXIT_URL = 'https://www.google.com';

/**
 * The sync server we run. Empty until the server is deployed: the app
 * works on one phone without it. A member can point the app at any other
 * server, including one they host themselves.
 */
export const DEFAULT_SYNC_SERVER = '';