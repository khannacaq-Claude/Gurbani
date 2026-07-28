// Gurbani Fashion — service worker
// Caches only the static app shell (HTML/manifest/icons) so the app opens
// instantly and works offline for browsing. Deliberately does NOT cache
// any /api/* calls to your Railway backend — orders, designs, prices etc.
// must always come fresh from the network, never from a stale cache.

const CACHE_NAME = 'gurbani-shell-v1';
const SHELL_FILES = [
  './',
  './index.html',
  './manifest.json',
  './favicon.svg',
  './favicon-32.png',
  './icon-192.png',
  './icon-512.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL_FILES))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((names) =>
      Promise.all(
        names.filter((name) => name !== CACHE_NAME).map((name) => caches.delete(name))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Never touch API calls — always go straight to network, live data only.
  if (url.pathname.includes('/api/')) {
    return;
  }

  // Only handle GET requests for our own origin's shell files.
  if (event.request.method !== 'GET' || url.origin !== self.location.origin) {
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cached) => {
      const networkFetch = fetch(event.request)
        .then((response) => {
          if (response && response.status === 200) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          }
          return response;
        })
        .catch(() => cached); // offline fallback to cache if network fails

      // Cache-first for instant loads, but still refresh cache in background.
      return cached || networkFetch;
    })
  );
});
