// IndexedDB owns catalog JSON. The worker owns documents, static files and images.
importScripts("/sw-assets.js");
const SHELL = "kudi-shell-" + self.__KUDI_BUILD;
const IMAGES = "product-images";
const MAX_AGE = 30 * 24 * 60 * 60 * 1000;
async function saveImage(cache, request, response) {
  const headers = new Headers(response.headers);
  headers.set("X-Kudi-Cached-At", String(Date.now()));
  await cache.put(
    request,
    new Response(await response.clone().arrayBuffer(), {
      status: response.status,
      headers,
    }),
  );
  const keys = await cache.keys();
  while (keys.length > 100) await cache.delete(keys.shift());
}
self.addEventListener("install", (event) =>
  event.waitUntil(
    (async () => {
      const cache = await caches.open(SHELL);
      await cache.addAll([
        "/",
        "/products",
        "/cart",
        "/icon.svg",
        "/manifest.json",
        ...self.__KUDI_ASSETS.filter(
          (url) => !url.startsWith("/img/products/"),
        ),
      ]);
      // Seed photos can load before the first worker takes control; save them during installation too.
      const images = await caches.open(IMAGES);
      await Promise.all(
        self.__KUDI_ASSETS
          .filter((url) => url.startsWith("/img/products/"))
          .map(async (url) => {
            const request = new Request(url);
            const response = await fetch(request);
            if (response.ok) await saveImage(images, request, response);
          }),
      );
      self.skipWaiting();
    })(),
  ),
);
self.addEventListener("activate", (event) =>
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key.startsWith("kudi-shell-") && key !== SHELL)
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  ),
);
self.addEventListener("fetch", (event) => {
  const request = event.request,
    url = new URL(request.url);
  if (request.method !== "GET" || url.origin !== location.origin) return;
  // This rule must run before the API rule: uploaded images share the API prefix.
  if (
    url.pathname.startsWith("/img/products/") ||
    url.pathname.startsWith("/api/v1/images/")
  ) {
    event.respondWith(
      (async () => {
        const cache = await caches.open(IMAGES);
        const hit = await cache.match(request);
        if (
          hit &&
          Date.now() - Number(hit.headers.get("X-Kudi-Cached-At") ?? 0) <
            MAX_AGE
        )
          return hit;
        const response = await fetch(request);
        if (response.ok) await saveImage(cache, request, response);
        else if (hit) await cache.delete(request);
        return response;
      })(),
    );
    return;
  }
  // Every other API request and every RSC payload is NetworkOnly.
  if (
    url.pathname.startsWith("/api/") ||
    request.headers.get("RSC") === "1" ||
    url.searchParams.has("_rsc")
  )
    return;
  if (url.pathname.startsWith("/admin") || url.pathname === "/stats") {
    if (request.mode === "navigate")
      event.respondWith(
        fetch(request).catch(
          () =>
            new Response(
              '<!doctype html><html lang="en"><meta name="viewport" content="width=device-width"><title>Admin is offline</title><body style="font:18px system-ui;padding:40px;color:#335844"><h1>The control room needs a connection.</h1><p>Reconnect to manage your store.</p><a href="/">Return to the saved shop</a></body></html>',
              {
                status: 503,
                headers: {
                  "Content-Type": "text/html",
                  "Cache-Control": "no-store",
                },
              },
            ),
        ),
      );
    return;
  }
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then(async (response) => {
          if (response.ok)
            (await caches.open(SHELL)).put(url.pathname, response.clone());
          return response;
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
    url.pathname.startsWith("/fonts/") ||
    url.pathname === "/icon.svg"
  )
    event.respondWith(
      caches.match(request).then(
        (hit) =>
          hit ||
          fetch(request).then(async (response) => {
            if (response.ok)
              await (await caches.open(SHELL)).put(request, response.clone());
            return response;
          }),
      ),
    );
});
self.addEventListener("message", (event) => {
  if (event.data?.type !== "CACHE_PAGE") return;
  const path = event.data.path;
  if (
    typeof path !== "string" ||
    !/^\/(?:products(?:\/[a-z0-9-]+)?|cart)?$/.test(path)
  )
    return;
  event.waitUntil(
    caches
      .open(SHELL)
      .then(async (cache) => {
        const response = await fetch(path, {
          headers: { Accept: "text/html" },
        });
        if (response.ok) await cache.put(path, response);
      })
      .catch(() => {}),
  );
});
