\
'use strict';
// Service worker de cache hors-ligne pour Puzzle Dojo.
// Remplace le SW "deprecated" de Flutter (qui ne met rien en cache).
// Strategie : cache-first + mise en cache runtime de toute ressource same-origin,
// avec repli sur index.html pour les navigations hors-ligne.
const CACHE = 'puzzle-dojo-cache-v1';
const CORE = [
  './',
  'index.html',
  'flutter_bootstrap.js',
  'flutter.js',
  'main.dart.js',
  'manifest.json',
  'favicon.png',
];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(CORE).catch(() => {}))
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  // Laisse passer le cross-origin (ex: classement Supabase) sans interferer.
  if (url.origin !== self.location.origin) return;
  event.respondWith((async () => {
    const cached = await caches.match(req);
    if (cached) return cached;
    try {
      const res = await fetch(req);
      if (res && res.status === 200) {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(req, copy));
      }
      return res;
    } catch (e) {
      if (req.mode === 'navigate') {
        const idx = await caches.match('index.html');
        if (idx) return idx;
      }
      throw e;
    }
  })());
});
