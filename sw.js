// Service worker for "Le Système Solaire d'Adélie"
// Caches the app so it keeps working with no wifi (e.g. in the car or a plane).
// Bump CACHE_VERSION whenever index.html or assets change to push an update.
const CACHE_VERSION = 'sys-solaire-v1';

// The app shell — cached up front on install.
const APP_SHELL = [
  './',
  './index.html',
  './icon.svg',
  './manifest.webmanifest',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION).then((cache) => cache.addAll(APP_SHELL))
  );
  self.skipWaiting();
});

// Remove old caches when a new version activates.
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_VERSION).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  const isFont = url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com';

  // Google Fonts: cache-first, then fetch and store on first online load.
  if (isFont) {
    event.respondWith(
      caches.match(req).then((cached) =>
        cached ||
        fetch(req).then((res) => {
          const copy = res.clone();
          caches.open(CACHE_VERSION).then((cache) => cache.put(req, copy));
          return res;
        }).catch(() => cached)
      )
    );
    return;
  }

  // App files: cache-first, fall back to network, then to the cached page for navigations.
  event.respondWith(
    caches.match(req).then((cached) =>
      cached ||
      fetch(req).then((res) => {
        if (res.ok && url.origin === self.location.origin) {
          const copy = res.clone();
          caches.open(CACHE_VERSION).then((cache) => cache.put(req, copy));
        }
        return res;
      }).catch(() => {
        if (req.mode === 'navigate') return caches.match('./index.html');
      })
    )
  );
});
