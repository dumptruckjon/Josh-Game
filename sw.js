// Service worker for Josh's Games — makes it installable and work offline (great
// for car rides). Strategy: NETWORK-FIRST so online visitors always get fresh
// content (no stale-caching bugs), with a cache fallback when offline. The cache
// name is versioned (__BUILD__ is rewritten to the commit SHA at deploy time),
// and old caches are purged on activate.

const VERSION = "__BUILD__";
const CACHE = `josh-${VERSION}`;
const CORE = [
  "./",
  "./index.html",
  "./styles/main.css",
  "./scripts/content.js",
  "./scripts/logic.js",
  "./scripts/effects.js",
  "./scripts/audio.js",
  "./scripts/art.js",
  "./scripts/stickers.js",
  "./scripts/buddy.js",
  "./scripts/framework.js",
  "./scripts/games-toys.js",
  "./scripts/games-math.js",
  "./scripts/games-logic.js",
  "./scripts/games-literacy.js",
  "./scripts/games-science.js",
  "./scripts/games-calm.js",
  "./scripts/games-fun.js",
  "./scripts/games-find.js",
  "./scripts/main.js",
  "./manifest.webmanifest",
];

self.addEventListener("install", (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(CORE).catch(() => {}))
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  // For page navigations, bypass the HTTP cache so a fresh deploy shows
  // immediately when online (falls back to cache only when offline).
  const isNav = req.mode === "navigate";
  const fetchReq = isNav ? new Request(req, { cache: "no-store" }) : req;
  event.respondWith(
    fetch(fetchReq)
      .then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((cache) => cache.put(req, copy)).catch(() => {});
        return res;
      })
      .catch(() =>
        caches.match(req).then((cached) => cached || caches.match("./index.html"))
      )
  );
});
