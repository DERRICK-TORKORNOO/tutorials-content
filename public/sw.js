// Next's HTML and RSC responses have different shapes; only cache document navigations.
// API data belongs exclusively to TanStack Query's IndexedDB persistence.
importScripts("/sw-assets.js");
const CACHE = "kudi-shell-" + self.__KUDI_BUILD;
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) =>
        cache.addAll([
          "/",
          "/products",
          "/cart",
          "/icon.svg",
          "/manifest.json",
          ...self.__KUDI_ASSETS,
        ]),
      )
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
            .filter((k) => k.startsWith("kudi-shell-") && k !== CACHE)
            .map((k) => caches.delete(k)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});
self.addEventListener("fetch", (event) => {
  const req = event.request,
    url = new URL(req.url);
  if (
    req.method !== "GET" ||
    url.origin !== location.origin ||
    url.pathname.startsWith("/api/") ||
    req.headers.get("RSC") === "1" ||
    url.searchParams.has("_rsc")
  )
    return;
  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req)
        .then(async (res) => {
          if (res.ok) {
            const cache = await caches.open(CACHE);
            await cache.put(url.pathname, res.clone());
          }
          return res;
        })
        .catch(
          async () =>
            (await caches.match(url.pathname)) ||
            (await caches.match("/")) ||
            Response.error(),
        ),
    );
    return;
  }
  if (
    url.pathname.startsWith("/_next/static/") ||
    url.pathname.startsWith("/img/") ||
    url.pathname.startsWith("/fonts/") ||
    url.pathname === "/icon.svg"
  ) {
    event.respondWith(
      caches.match(req).then(
        (hit) =>
          hit ||
          fetch(req).then(async (res) => {
            if (res.ok) {
              const cache = await caches.open(CACHE);
              await cache.put(req, res.clone());
            }
            return res;
          }),
      ),
    );
  }
});

self.addEventListener("message", (event) => {
  if (event.data?.type === "CACHE_PAGE") {
    const path = event.data.path;
    if (
      typeof path === "string" &&
      path.startsWith("/") &&
      !path.startsWith("//") &&
      !path.startsWith("/api/")
    )
      event.waitUntil(
        caches
          .open(CACHE)
          .then(async (cache) => {
            const response = await fetch(path, {
              headers: { Accept: "text/html" },
            });
            if (response.ok) await cache.put(path, response);
          })
          .catch(() => {}),
      );
  }
});
