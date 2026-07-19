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
  "./scripts/hl-content.js",
  "./scripts/games-hl-a.js",
  "./scripts/games-hl-b.js",
  "./scripts/hl-main.js",
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
        // Offline fallback. Try an EXACT cache hit first (a runtime-cached
        // response, version query and all). If that misses, retry ignoring the
        // ?v=<sha> cache-bust query so the UNVERSIONED precache (CORE lists
        // "./scripts/main.js" while the page requests "…?v=<sha>") still
        // satisfies the request — otherwise every script 404s to the HTML
        // fallback offline and the app boots as a dead shell ("Unexpected token
        // '<'"). Safe because ?v= only busts the cache; the file at a given path
        // is identical across versions, and network-first keeps things fresh
        // whenever the device IS online. Navigations fall back to index.html.
        caches.match(req).then((cached) =>
          cached ||
          caches.match(req, { ignoreSearch: true }).then((loose) => loose || caches.match("./index.html"))
        )
      )
  );
});
