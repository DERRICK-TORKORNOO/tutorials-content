# Tutorial 1 — make the whole shop work offline

A standalone Next.js tutorial focused on **service workers and Cache Storage**. It keeps the Kudi Store design, product browsing, search, categories, gallery and device-local bag. All 12 product detail pages are generated at build time, including those you have not opened yet.

No API keys, database or account is required. There is no TanStack Query, IndexedDB persister, product-version polling, admin dashboard or queued checkout in this tutorial. The full application remains on `main` in the original repository.

## Run

Node.js 22+ and npm:

```sh
npm ci
npm run build
npm run preview
```

Open http://localhost:3000. Wait for **“Offline ready · the whole catalog is saved”** before turning off the network. You can then reload the homepage, browse the collection and open any of the 12 product URLs, including a product you never opened while online.

Build and type-check commands clear generated route types first. This prevents cached routes from a different branch from affecting this example. Stop any running development server before switching branches or rebuilding. Your source files and local environment file are preserved.

`npm run dev` is for design work; it does not register the service worker. Stop the dev server before using the production preview on the same port. The preview sets HTTP `Cache-Control: no-store` so the tutorial demonstrates the service worker rather than the normal HTTP cache.

## How offline caching works

1. `src/hooks/useCatalog.ts` fetches local JSON with `useEffect`. There is no React data cache.
2. `src/components/offline-setup.tsx` registers `/sw.js` after visiting the production site. “Offline ready” appears after installation finishes.
3. `scripts/build-sw.mjs` lists all exported pages, scripts, styles, JSON, fonts, icons and product images. It writes `out/sw-assets.js` and a content hash identifying the build.
4. `public/sw.js` installs that list with `cache.addAll`, claims the browser tab, and serves same-origin GET requests from Cache Storage first.
5. Ordinary `<a>` links make navigation a full document request, allowing the service worker to serve each saved HTML page directly.

```js
// Install the entire tutorial site.
cache.addAll(self.__KUDI_ASSETS);

// On each GET request, prefer the saved copy.
const saved = await cache.match(path);
if (saved) return saved;
return fetch(request);
```

Product data is in `public/data/products.json` and categories in `public/data/categories.json`. Editing the catalog requires rebuilding. This branch deliberately prioritizes a simple frozen offline snapshot; freshness, server data, query caches and offline order submission belong to later tutorials. A different build hash creates a new cache; activation removes this shop's older caches. Other websites' caches are not removed.

The bag uses localStorage to keep the user's selections, independently of the worker. Checkout is introduced later. There is no transaction endpoint to cache or replay.

## Explore offline behaviour

1. Build and preview, open the shop online and wait for the offline-ready message.
2. In browser developer tools, select Network → Offline (or use airplane mode on the phone).
3. Reload the homepage: its HTML, JavaScript, CSS, fonts and JSON still load.
4. Open a product you did not previously visit: its static page, gallery and data are already saved.
5. Refresh that product URL while offline, then open `/products/` or `/cart/`.
6. Re-enable the network before testing a new build.

The first visit and the complete installation require a connection. Browser storage must remain available; clearing site data removes the cache. On a phone, use an HTTPS deployment: ordinary LAN HTTP addresses cannot register service workers. Avoid running different tutorial branches at the same localhost origin when testing; use separate preview origins or clear site data between them.

## Checks

```sh
npm run lint
npm run typecheck
npm run build
npm test
```

The automated worker tests simulate a fully offline origin after installation and assert that precached pages, data and assets still load. Build output can also be checked through the local preview. These checks do not replace testing airplane mode on a physical device.

## Deploy to Vercel

This branch exports a static site to `out/`. `vercel.json` sets the build command, output directory and worker update headers. No environment variables are needed. Import the repository into Vercel and select `tutorial-1` as the deployment branch.

## Learning path

`tutorial-1` introduces service-worker caching with a static catalog. The `main` branch extends the shop with server data, an admin dashboard, query persistence and offline order handling.

## Credits

Photos and fonts are hosted locally. See `public/img/CREDITS.md` and `public/fonts/CREDITS.md`.
