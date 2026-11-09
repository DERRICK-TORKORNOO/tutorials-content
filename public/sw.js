// Tutorial 1: one Cache Storage bucket saves the entire static shop.
importScripts("/sw-assets.js");
const CACHE = "kudi-tutorial-1-" + self.__KUDI_BUILD;
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(self.__KUDI_ASSETS))
      .then(() => self.skipWaiting()),
  );
});
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter(
              (key) =>
                (key.startsWith("kudi-tutorial-1-") ||
                  key.startsWith("kudi-shell-") ||
                  key === "product-images") &&
                key !== CACHE,
            )
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});
self.addEventListener("fetch", (event) => {
  const request = event.request,
    url = new URL(request.url);
  if (
    request.method !== "GET" ||
    url.origin !== location.origin ||
    url.pathname === "/sw.js" ||
    url.pathname === "/sw-assets.js"
  )
    return;
  // Native links make page visits full document requests: HTML, JS and JSON all use CacheFirst.
  const path =
    request.mode === "navigate" && !/\.[a-z0-9]+$/i.test(url.pathname)
      ? url.pathname.replace(/\/?$/, "/")
      : url.pathname;
  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE);
      const saved = await cache.match(path);
      if (saved) return saved;
      try {
        const response = await fetch(request);
        if (response.ok) await cache.put(path, response.clone());
        return response;
      } catch {
        if (request.mode === "navigate")
          return (await cache.match("/offline.html")) || Response.error();
        return Response.error();
      }
    })(),
  );
});
