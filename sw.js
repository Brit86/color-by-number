/**
 * sw.js — Service worker for Color by Number (spec §3).
 *
 * Two versioned caches:
 *   cbn-shell-v1   — app shell (HTML, CSS, JS, manifest, icons, offline page)
 *   cbn-starter-v1 — bundled starter content + bundled catalog
 *
 * Cache-first: the shell never needs the network. Old caches are deleted in
 * `activate`, which only runs after a new worker's `install` has fully
 * populated its caches — so the last known working shell is never removed
 * before its replacement is available.
 */

const SHELL_CACHE = "cbn-shell-v1";
const STARTER_CACHE = "cbn-starter-v1";

const SHELL_ASSETS = [
  "./",
  "./index.html",
  "./offline.html",
  "./manifest.webmanifest",
  "./css/app.css",
  "./js/app.js",
  "./js/db.js",
  "./js/content.js",
  "./js/validate.js",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/icon-maskable-512.png",
  "./icons/apple-touch-icon.png",
];

const STARTER_CANVASES = [
  "cat-001",
  "dino-001",
  "rocket-001",
  "flower-001",
  "butterfly-001",
  "turtle-001",
];

const STARTER_ASSETS = ["./content/catalog.json"];
for (const id of STARTER_CANVASES) {
  STARTER_ASSETS.push(
    `./content/starter/${id}/manifest.json`,
    `./content/starter/${id}/canvas.svg`,
    `./content/starter/${id}/thumbnail.svg`,
  );
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    Promise.all([
      caches.open(SHELL_CACHE).then((cache) => cache.addAll(SHELL_ASSETS)),
      caches.open(STARTER_CACHE).then((cache) => cache.addAll(STARTER_ASSETS)),
    ]).then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key.startsWith("cbn-") && key !== SHELL_CACHE && key !== STARTER_CACHE)
          .map((key) => caches.delete(key)),
      ),
    ).then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  if (request.mode === "navigate") {
    event.respondWith(
      caches.match(request, { ignoreSearch: true }).then(
        (cached) =>
          cached ||
          fetch(request).catch(() => caches.match("./offline.html")),
      ),
    );
    return;
  }

  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;
      return fetch(request).catch(
        () => new Response("", { status: 504, statusText: "Offline" }),
      );
    }),
  );
});
