/* Service worker de « L'univers d'Ophélie » — généré au build. */
const VERSION = '__VERSION__';
const PREFIX = 'uo-app-';
const CACHE = PREFIX + VERSION;
const ASSETS = __ASSETS__;
const scopeUrl = (p) => new URL(p, self.registration.scope).href;

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll([scopeUrl('./'), ...ASSETS.map(scopeUrl)])),
  );
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  // Seuls les anciens caches de l'interface sont supprimés ; les données (IndexedDB) ne sont jamais touchées.
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith(PREFIX) && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  // Carte, recherche de lieux, liens externes : toujours en ligne, jamais mis en cache ici.
  if (url.origin !== self.location.origin || !req.url.startsWith(self.registration.scope)) return;

  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((res) => {
          if (res.ok) {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(scopeUrl('./'), copy));
          }
          return res;
        })
        .catch(() => caches.match(scopeUrl('./'), { ignoreSearch: true })),
    );
    return;
  }

  event.respondWith(
    caches.match(req, { ignoreSearch: true }).then(
      (hit) =>
        hit ||
        fetch(req).then((res) => {
          if (res.ok && res.type === 'basic') {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(req, copy));
          }
          return res;
        }),
    ),
  );
});
