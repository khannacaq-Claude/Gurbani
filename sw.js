// Gurbani Fashion — service worker
// Caches only the static app shell (HTML/manifest/icons) so the app opens
// instantly and works offline for browsing. Deliberately does NOT cache
// any /api/* calls to your Railway backend — orders, designs, prices etc.
// must always come fresh from the network, never from a stale cache.

const CACHE_NAME = 'gurbani-shell-v3';
const SHELL_FILES = [
  './',
  './index.html',
  './manifest.json',
  './favicon-16.png',
  './favicon-32.png',
  './icon-192.png',
  './icon-512.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) =>
      // Not cache.addAll(SHELL_FILES) — its internal fetches use the
      // default cache mode too, so a stale HTTP-cache hit could get baked
      // into the very first install. Fetch each file explicitly fresh instead.
      Promise.all(
        SHELL_FILES.map((file) =>
          fetch(file, { cache: 'reload' }).then((response) => {
            if (response && response.status === 200) return cache.put(file, response);
          })
        )
      )
    )
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

  // Network-first: always try to get the latest version when online, and
  // only fall back to the cache if the network fails (genuinely offline).
  // This is what actually delivers "works offline" without also trapping
  // users on stale content every time something is fixed/deployed.
  //
  // { cache: 'reload' } is deliberate and important here — a plain fetch()
  // can still be silently satisfied by the BROWSER's own HTTP cache layer
  // (separate from this service worker's Cache Storage), which defeats
  // "network-first" without this ever showing up as an error. This forces
  // an actual round-trip to the server every time, bypassing that layer.
  const freshRequest = new Request(event.request, { cache: 'reload' });
  event.respondWith(
    fetch(freshRequest)
      .then((response) => {
        if (response && response.status === 200) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        }
        return response;
      })
      .catch(() => caches.match(event.request))
  );
});
