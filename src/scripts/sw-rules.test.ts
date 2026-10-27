/**
 * The rules the service worker decides by (R3.10).
 *
 * The worker serves a file the app checked and handed over, or it does not
 * answer at all. A worker that kept whatever the server sent would be the
 * hole this whole setup exists to close, so the decisions it makes are out
 * here where a test can call them.
 */
import { describe, expect, it } from 'vitest';

import { cacheKeysFor, handles } from '../../public/sw-rules.mjs';

describe('R3.10 what the service worker takes', () => {
  it('holds the app and nothing else', () => {
    expect(handles('/app/today')).toBe(true);
    expect(handles('/app/')).toBe(true);
    expect(handles('/es/app/members')).toBe(true);
    expect(handles('/_astro/App.BB92oS_g.css')).toBe(true);
    expect(handles('/app-sw.js')).toBe(true);
    expect(handles('/rights/whats-changed')).toBe(false);
    expect(handles('/releases/0.1.0/manifest.json')).toBe(false);
    expect(handles('/')).toBe(false);
    // The rules module itself: a path the worker does not hold, so the
    // browser fetches it once from the network and the check in the
    // manifest covers it.
    expect(handles('/sw-rules.mjs')).toBe(false);
  });

  it('knows both forms of a page address', () => {
    expect(cacheKeysFor('/app/today')).toEqual(['/app/today', '/app/today/index.html']);
    expect(cacheKeysFor('/app/today/')).toEqual(['/app/today/']);
    expect(cacheKeysFor('/_astro/app.js')).toEqual(['/_astro/app.js']);
  });
});