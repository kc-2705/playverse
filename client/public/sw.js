/*
 * Playverse service worker. It makes the site installable as an app and
 * keeps the heavy game files (code, 3D models, textures) on the device.
 *
 * - Pages: network first, so a new deploy shows up right away; the cached
 *   page is the fallback when offline.
 * - Built code (/assets/*-hash.js|css): cache first; the file name changes
 *   whenever the content does.
 * - Models, covers, icons, fonts: served from the cache, refreshed in the
 *   background.
 * - The API and the live multiplayer connection always go to the network.
 */
const CACHE = 'playverse-v1';
const SHELL = ['/', '/manifest.webmanifest', '/icons/icon-192.png', '/icons/icon-512.png'];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

const hashed = (path) => /^\/assets\/[^/]+-[A-Za-z0-9_-]{8,}\.(js|css)$/.test(path);
const refreshable = (url) =>
  url.pathname.startsWith('/assets/') || url.pathname.startsWith('/covers/') || url.pathname.startsWith('/icons/') || url.hostname.endsWith('gstatic.com') || url.hostname.endsWith('googleapis.com');

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/socket.io/')) return;

  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put('/', copy));
          return res;
        })
        .catch(() => caches.match('/')),
    );
    return;
  }

  if (url.origin === location.origin && hashed(url.pathname)) {
    event.respondWith(
      caches.match(req).then(
        (hit) =>
          hit ||
          fetch(req).then((res) => {
            if (res.ok) caches.open(CACHE).then((c) => c.put(req, res.clone()));
            return res;
          }),
      ),
    );
    return;
  }

  if (refreshable(url)) {
    event.respondWith(
      caches.open(CACHE).then(async (c) => {
        const hit = await c.match(req);
        const fresh = fetch(req)
          .then((res) => {
            if (res.ok || res.type === 'opaque') c.put(req, res.clone());
            return res;
          })
          .catch(() => hit);
        return hit || fresh;
      }),
    );
  }
});
