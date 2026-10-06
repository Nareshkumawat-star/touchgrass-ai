/*
  TouchGrass AI service worker.

  Goals, in order:
   1. The app shell and the mission screen must open with no connection.
   2. Never cache API responses — mission generation and vision analysis are
      live operations, and stale AI output would be worse than an error.
   3. Never trap the user on a stale page: navigations are network-first.

  Offline completions are handled in application code (localStorage queue +
  /api/sync), not here, so a queued mission survives even if the worker is
  never installed.
*/

const VERSION = "touchgrass-v1";
const SHELL_CACHE = `${VERSION}-shell`;
const ASSET_CACHE = `${VERSION}-assets`;
const OFFLINE_URL = "/offline";

const SHELL_ASSETS = [
  "/",
  "/offline",
  "/manifest.webmanifest",
  "/icon.svg",
  "/icon-192.png",
  "/icon-512.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(SHELL_CACHE);
      // Individual failures (e.g. an icon) must not abort the whole install.
      await Promise.all(
        SHELL_ASSETS.map((asset) =>
          cache.add(new Request(asset, { cache: "reload" })).catch(() => undefined),
        ),
      );
      await self.skipWaiting();
    })(),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((key) => !key.startsWith(VERSION))
          .map((key) => caches.delete(key)),
      );
      await self.clients.claim();
    })(),
  );
});

function isAssetRequest(url) {
  return (
    url.pathname.startsWith("/_next/static/") ||
    url.pathname.startsWith("/_next/image") ||
    /\.(?:css|js|woff2?|png|jpg|jpeg|svg|webp|ico)$/i.test(url.pathname)
  );
}

self.addEventListener("fetch", (event) => {
  const { request } = event;

  // Only GET requests are cacheable, and only same-origin ones.
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Live AI and user data: always go to the network.
  if (url.pathname.startsWith("/api/")) return;

  // Navigations: network first, cache fallback, then the offline screen.
  if (request.mode === "navigate") {
    event.respondWith(
      (async () => {
        try {
          const response = await fetch(request);
          const cache = await caches.open(SHELL_CACHE);
          cache.put(request, response.clone()).catch(() => undefined);
          return response;
        } catch {
          const cached = await caches.match(request);
          if (cached) return cached;
          const offline = await caches.match(OFFLINE_URL);
          if (offline) return offline;
          return new Response(
            "<!doctype html><title>Offline</title><p>You are offline and this page was not saved. Open the app again once you have a connection.",
            { headers: { "content-type": "text/html; charset=utf-8" }, status: 503 },
          );
        }
      })(),
    );
    return;
  }

  // Static assets: cache first (they are content-hashed and immutable).
  if (isAssetRequest(url)) {
    event.respondWith(
      (async () => {
        const cached = await caches.match(request);
        if (cached) return cached;
        try {
          const response = await fetch(request);
          if (response.ok) {
            const cache = await caches.open(ASSET_CACHE);
            cache.put(request, response.clone()).catch(() => undefined);
          }
          return response;
        } catch (error) {
          throw error;
        }
      })(),
    );
  }
});
