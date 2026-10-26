/**
 * True when a URL points at another site (the leaving-the-site warning, L1).
 * Non-http(s) protocols (mailto, tel) never count as external.
 */
export function isExternalUrl(url: URL, siteHost: string): boolean {
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    return false;
  }
  const host = url.host.toLowerCase();
  const site = siteHost.toLowerCase();
  if (host === site) {
    return false;
  }
  // Treat www.site as site.
  if (host === `www.${site}`) {
    return false;
  }
  return true;
}