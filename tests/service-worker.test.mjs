import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";
const worker = await readFile("public/sw.js", "utf8");
function setup() {
  const listeners = {};
  const stores = new Map();
  let online = true;
  let requests = 0;
  let claimed = false;
  const pages = [
    "/",
    "/products/",
    "/products/new-find/",
    "/data/products.json",
    "/img/products/bag.webp",
    "/app.js",
    "/offline.html",
  ];
  const bodies = Object.fromEntries(
    pages.map((path) => [path, `saved:${path}`]),
  );
  const key = (input) =>
    new URL(typeof input === "string" ? input : input.url, "https://shop.test")
      .pathname;
  const fetch = async (request) => {
    requests++;
    if (!online) throw Error("Offline");
    const name = key(request);
    return new Response(bodies[name] ?? "missing", {
      status: bodies[name] ? 200 : 404,
    });
  };
  const caches = {
    keys: async () => [...stores.keys()],
    delete: async (name) => stores.delete(name),
    open: async (name) => {
      if (!stores.has(name)) stores.set(name, new Map());
      const data = stores.get(name);
      return {
        match: async (request) => data.get(key(request))?.clone(),
        put: async (request, response) => {
          data.set(key(request), response.clone());
        },
        addAll: async (urls) => {
          const responses = await Promise.all(urls.map(fetch));
          if (responses.some((r) => !r.ok)) throw Error("Incomplete install");
          for (let i = 0; i < urls.length; i++)
            data.set(key(urls[i]), responses[i]);
        },
      };
    },
  };
  const self = {
    __KUDI_BUILD: "test",
    __KUDI_ASSETS: pages,
    skipWaiting: () => {},
    clients: {
      claim: async () => {
        claimed = true;
      },
    },
    addEventListener: (type, callback) => {
      listeners[type] = callback;
    },
  };
  vm.runInNewContext(worker, {
    self,
    caches,
    fetch,
    Response,
    URL,
    location: { origin: "https://shop.test" },
    importScripts: () => {},
  });
  async function dispatch(type) {
    let promise;
    listeners[type]({
      waitUntil: (value) => {
        promise = value;
      },
    });
    await promise;
  }
  async function get(path, mode = "navigate", method = "GET") {
    let promise;
    listeners.fetch({
      request: { url: `https://shop.test${path}`, method, mode },
      respondWith: (value) => {
        promise = value;
      },
    });
    return promise ? await promise : null;
  }
  return {
    dispatch,
    get,
    stores,
    setOffline: () => {
      online = false;
    },
    get requests() {
      return requests;
    },
    get claimed() {
      return claimed;
    },
  };
}
test("every saved page, image, script and JSON response works with the origin offline", async () => {
  const app = setup();
  await app.dispatch("install");
  await app.dispatch("activate");
  assert.equal(app.claimed, true);
  const requests = app.requests;
  app.setOffline();
  for (const path of [
    "/",
    "/products/",
    "/products/new-find/",
    "/data/products.json",
    "/img/products/bag.webp",
    "/app.js",
  ])
    assert.equal(
      await (
        await app.get(path, path.includes(".") ? "cors" : "navigate")
      ).text(),
      `saved:${path}`,
    );
  assert.equal(app.requests, requests);
});
test("unvisited product routes, query strings and trailing slashes use the precached document", async () => {
  const app = setup();
  await app.dispatch("install");
  app.setOffline();
  assert.equal(
    await (await app.get("/products/new-find?debug=1")).text(),
    "saved:/products/new-find/",
  );
});
test("unknown offline pages get the offline fallback; writes are never intercepted", async () => {
  const app = setup();
  await app.dispatch("install");
  app.setOffline();
  assert.equal(
    await (await app.get("/not-in-catalog/")).text(),
    "saved:/offline.html",
  );
  assert.equal(await app.get("/checkout", "cors", "POST"), null);
});
test("activation removes old shop caches and preserves unrelated caches", async () => {
  const app = setup();
  app.stores.set("kudi-tutorial-1-old", new Map());
  app.stores.set("unrelated-app", new Map());
  await app.dispatch("install");
  await app.dispatch("activate");
  assert.equal(app.stores.has("kudi-tutorial-1-old"), false);
  assert.equal(app.stores.has("unrelated-app"), true);
  assert.equal(app.stores.has("kudi-tutorial-1-test"), true);
});
