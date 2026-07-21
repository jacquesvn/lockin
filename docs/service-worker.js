/* Lockin service worker — offline app shell.
   Navigations are network-first so a redeploy lands immediately (falls back to cache offline);
   static assets are cache-first. Bump CACHE to the app version on every release. */
const CACHE = 'lockin-0.11.3';
const ASSETS = ['./index.html', './manifest.webmanifest', './icon.svg', './icon-192.png', './icon-512.png'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  // Cross-origin (the optional Leetify read) goes straight to the network, never
  // through our cache. Leetify's guidelines ask that their data not be stored, and
  // the cache-first branch below would otherwise be a place it could land.
  try { if (new URL(req.url).origin !== self.location.origin) return; } catch (_) { return; }
  const accept = req.headers.get('accept') || '';
  const isNav = req.mode === 'navigate' || accept.indexOf('text/html') >= 0;
  if (isNav) {
    // network-first: always try the fresh page, cache a copy, fall back to cache when offline
    e.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put('./index.html', copy)).catch(() => {});
          return res;
        })
        .catch(() => caches.match(req).then((r) => r || caches.match('./index.html')))
    );
    return;
  }
  // cache-first for static assets
  e.respondWith(caches.match(req).then((r) => r || fetch(req)));
});
