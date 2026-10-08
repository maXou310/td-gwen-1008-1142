// sw.js — service worker for TD Gwen (app-shell PWA).
// Cache-first for same-origin GETs; navigation requests fall back to the
// cached index.html so offline reload works. Runtime cache catches anything
// not pre-cached (e.g. fonts). Bump SW_VERSION to invalidate all caches.
const SW_VERSION = 'v1-pwa';
const CACHE = 'td-gwen-' + SW_VERSION;

// Full app shell, enumerated statically from the repo tree (no runtime glob).
// tools/ is intentionally excluded (dev-only scripts).
const ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './sw.js',
  './css/style.css',
  './src/main.js',
  './src/core/config.js',
  './src/core/save.js',
  './src/sim/engine.js',
  './src/path/path.js',
  './src/render/renderer.js',
  './src/entities/towers.js',
  './src/entities/enemies.js',
  './src/entities/waves.js',
  './src/entities/projectiles.js',
  './src/entities/particles.js',
  './src/ui/hud.js',
  './src/ui/input.js',
  './src/ui/menu.js',
  './src/art/sprites.js',
  './src/audio/audio.js',
  './src/pwa/register.js',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-512-maskable.png'
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // App-shell pattern: navigation requests serve cached index.html when the
  // exact URL is not cached (offline reload / unknown paths).
  if (req.mode === 'navigate') {
    e.respondWith(
      caches.match(req).then((hit) => hit || fetch(req).then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(req, copy));
        return res;
      }).catch(() => caches.match('./index.html')))
    );
    return;
  }

  // Everything else: cache-first with network fallback + runtime caching.
  e.respondWith(
    caches.match(req).then((hit) => hit || fetch(req).then((res) => {
      const copy = res.clone();
      caches.open(CACHE).then((c) => c.put(req, copy));
      return res;
    }))
  );
});
