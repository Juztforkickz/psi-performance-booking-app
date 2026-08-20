const STATIC_CACHE = "psi-static-v2";
const SHELL_CACHE = "psi-shell-v1";
const STATIC_ASSETS = [
  "/psi-logo.png",
  "/psi-hero.jpg",
  "/psi-hero-mobile.jpg",
  "/psi-service-1.png",
  "/psi-service-2.png",
  "/psi-dyno.jpg",
  "/psi-icon-192.png",
  "/psi-icon-512.png",
  "/psi-favicon.png",
  "/psi-contact-qr.png",
  "/ethnocentric.woff2",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    Promise.all([
      caches.open(STATIC_CACHE).then((cache) => cache.addAll(STATIC_ASSETS)),
      fetch("/").then(async (response) => {
        if (!response.ok) return;

        const shellCache = await caches.open(SHELL_CACHE);
        await shellCache.put("/", response.clone());

        const html = await response.text();
        const appAssets = Array.from(
          html.matchAll(/(?:src|href)="(\/_next\/static\/[^"?#]+)"/g),
          (match) => match[1],
        );
        await shellCache.addAll([...new Set(appAssets)]);
      }),
    ]),
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => ![STATIC_CACHE, SHELL_CACHE].includes(key)).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  const url = new URL(request.url);

  if (request.method !== "GET" || url.origin !== self.location.origin || url.pathname.startsWith("/api/")) return;

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) caches.open(SHELL_CACHE).then((cache) => cache.put("/", response.clone()));
          return response;
        })
        .catch(() => caches.match("/")),
    );
    return;
  }

  if (STATIC_ASSETS.includes(url.pathname)) {
    event.respondWith(caches.match(request).then((cached) => cached || fetch(request)));
    return;
  }

  if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith(caches.match(request).then((cached) => cached || fetch(request)));
  }
});
