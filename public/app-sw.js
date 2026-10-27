/**
 * The service worker for the Committee Workspace.
 *
 * Its whole job is to hold a known-good copy of the app. The running app
 * checks a release, verifies every file against the signed manifest, and
 * only then hands the files to this worker. So the cache holds files that
 * were checked, and nothing else.
 *
 * A file the worker does not have is fetched from the network and is not
 * kept. A worker that cached whatever it fetched would let a tampered
 * server put code in the cache, which is the thing this whole setup
 * exists to prevent.
 *
 * The worker never writes to the disk and never sends anything anywhere.
 * It cannot reach the workspace: that stays in IndexedDB, where only the
 * app can get at it.
 */
const CACHE_PREFIX = 'oyw-app-';
const META_CACHE = `${CACHE_PREFIX}meta`;
const ACTIVE_URL = '/__oyw-active-version';
const PATHS_URL = '/__oyw-release-paths';

/** The version in use, as the worker last heard it. */
async function activeVersion() {
  const meta = await caches.open(META_CACHE);
  const response = await meta.match(new Request(ACTIVE_URL));
  return response ? response.text() : null;
}

/** The cache for a version. */
function versionCache(version) {
  return caches.open(`${CACHE_PREFIX}${version}`);
}

/**
 * The app sends the files it has checked: the version, and each file with
 * its bytes. They go into a cache named for that version.
 */
async function cacheFiles(data) {
  const cache = await versionCache(data.version);
  for (const file of data.files ?? []) {
    const response = new Response(file.body, {
      headers: { 'content-type': file.contentType ?? 'application/octet-stream' },
    });
    await cache.put(file.url, response);
  }
  const meta = await caches.open(META_CACHE);
  await meta.put(new Request(ACTIVE_URL), new Response(data.version));
  // The list of paths, so the worker knows what it is allowed to serve.
  await meta.put(
    new Request(PATHS_URL),
    new Response(JSON.stringify({ version: data.version, paths: (data.files ?? []).map((f) => f.url) })),
  );
}

async function activate(version) {
  const names = await caches.keys();
  await Promise.all(
    names
      .filter((name) => name.startsWith(CACHE_PREFIX) && name !== `${CACHE_PREFIX}${version}` && name !== META_CACHE)
      .map((name) => caches.delete(name)),
  );
  const meta = await caches.open(META_CACHE);
  await meta.put(new Request(ACTIVE_URL), new Response(version));
}

/** The files of the release in use, as a set of paths. */
async function releasePaths(version) {
  const meta = await caches.open(META_CACHE);
  const response = await meta.match(new Request('/__oyw-release-paths'));
  if (!response) return null;
  const stored = JSON.parse(await response.text());
  return stored.version === version ? new Set(stored.paths) : null;
}

self.addEventListener('install', () => {
  // Nothing to install. The app hands over the files it has checked.
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('message', (event) => {
  const data = event.data;
  if (!data || typeof data !== 'object') return;
  const reply = (message) => event.source?.postMessage(message);

  if (data.type === 'cache-files') {
    event.waitUntil(
      cacheFiles(data).then(
        () => reply({ type: 'cached', version: data.version, count: (data.files ?? []).length }),
        (error) => reply({ type: 'error', reason: String(error) }),
      ),
    );
    return;
  }

  if (data.type === 'activate') {
    event.waitUntil(
      activate(data.version).then(
        () => reply({ type: 'activated', version: data.version }),
        (error) => reply({ type: 'error', reason: String(error) }),
      ),
    );
    return;
  }

  if (data.type === 'which-version') {
    event.waitUntil(
      activeVersion().then(
        (version) => reply({ type: 'version', version }),
        () => reply({ type: 'version', version: null }),
      ),
    );
  }
});

import {
  cacheKeysFor,
  handles,
} from './sw-rules.mjs';

/**
 * The copy in the cache wins. A file the app has not checked comes from
 * the network, and is not kept.
 */
self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (!handles(url.pathname)) {
    // Everything else on the site is content. It goes to the network, the
    // way it always did.
    return;
  }

  event.respondWith(
    (async () => {
      const version = await activeVersion();
      if (version) {
        const cache = await versionCache(version);
        for (const key of cacheKeysFor(url.pathname)) {
          const cached = await cache.match(new Request(key, request), { ignoreSearch: true });
          if (cached) return cached;
        }
      }
      return fetch(request);
    })(),
  );
});
