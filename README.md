# Kudi Store

A polished, mobile-first shop and offline-first teaching project, adapted to **Next.js App Router** at the owner's request. Forest green, warm neutrals, local product photography, and editorial typography. No payment is taken: checkout creates demo orders.

## Run

Requires Node.js 22 or newer and npm.

```sh
npm install
cp .env.example .env.local
# Edit ADMIN_KEY in .env.local before using the demo dashboard.
npm run dev
```

Open http://localhost:3000. Browse `/products`, `/products/everyday-runner`, and `/cart`. The filming dashboard is `/stats`; it is deliberately absent from the shop navigation. Add `?debug=1` to see the data source pill; the preference lasts for the tab session.

For the real offline demo, use the **production build**, not development:

```sh
npm run build
npm run preview
```

`npm run lint` and `npm run typecheck` check the source. `npm run format` formats it. The build generates `public/sw-assets.js`, a list of the current build's chunks, fonts, and images for service-worker precaching. Do not reuse this generated file across builds.

## What changed from the supplied brief

Next.js replaces Vite and React Router. Next Route Handlers replace the separate Hono server, so frontend and API run together in one command. A small native service worker replaces vite-plugin-pwa: it precaches the actual Next build, uses network-first HTML documents, and never caches API responses or React Server Component payloads. Offline navigation uses full documents because server rendering/RSC cannot run without a server.

The same TanStack Query v5 → IndexedDB persistence → app-shell service worker layering remains. Styles use plain CSS rather than Tailwind, so the design has no additional styling runtime. Product photos are shared across variants within each category; each product has two locally hosted views. These are demonstration products rather than a commercial inventory.

## Where to look

- `src/components/shop.tsx`: storefront, product gallery, local cart, demo checkout.
- `src/hooks/useCatalog.ts`: the small catalog data-access layer.
- `src/lib/api.ts`: requests, no HTTP caching, response version notifications.
- `src/lib/queryClient.ts`: query defaults and the resumable order mutation default.
- `src/lib/persist.ts`: async IndexedDB storage and restored-query markers.
- `src/components/providers.tsx`: restoration, catalog version checks, service-worker registration.
- `src/hooks/useDataSource.ts`: network / memory / restored-cache debug label.
- `public/sw.js`, `scripts/build-sw.mjs`: offline shell and build asset list.
- `src/app/api/v1/[...path]/route.ts`: versioned API, validation and admin guard.
- `src/lib/store.ts`: Redis optimistic compare-and-set and local in-memory fallback.
- `src/lib/products.ts`: seed inventory and the store brand constant.
- `public/img/CREDITS.md`: photography sources.

## API and state

All API responses use `Cache-Control: no-store` and `X-Catalog-Version`. Catalog changes increase a shared integer. The client checks the tiny `/api/v1/meta/version` response at startup, on visibility and reconnection; unchanged versions leave catalog queries alone. The final client uses infinite stale time because version checks, rather than elapsed time, decide freshness. Query garbage collection and persisted-cache maximum age both equal 24 hours. The package version busts incompatible persisted data.

Catalog endpoints: `GET /products`, `/products/:slug`, `/categories`. Operational endpoints: `GET /meta/version`, `/stats`, `/orders`. All paths are relative to `/api/v1`.

`POST /cart` takes `{ items: [{ slug, qty }], requestId }`. A stable request ID makes retries idempotent, and the backend validates stock and computes totals from server prices. Admin POST routes require `x-admin-key`: `/admin/products/:slug`, `/admin/slow-mode`, `/admin/reset`. Price/stock edits, checkout stock changes and resets increment the catalog version. Slow mode accepts 0, 800 or 2000 ms and affects catalog requests only.

Set Upstash's REST URL/token for durable shared state. Without both, state exists only in the local server process. On Vercel, **configure Upstash** to make state consistent across functions. The compact demo uses one Redis state document with optimistic concurrency; it is intended for tutorial traffic, not a large production shop. Reset is a deliberate demo operation.

## Tutorial sequence

### 1. Plain fetch (`step-1-fetch`, `v1-step-1`)

Read `useCatalog.ts`. `useEffect` fetches into local state and exposes shaped loading/error/retry states. No catalog cache: visit a product twice and watch `/stats` increase. Go offline and navigate: the request fails. Reloading offline is expected to fail.

### 2. Query cache (`step-2-tanstack`, `v2-step-2`)

The important lines are `useQuery`, the catalog query key, detail `initialData`, and the three query defaults in `queryClient.ts`: `staleTime: 60_000`, `gcTime: 86_400_000`, `retry: 1`. Navigate back within a minute: the cached catalog renders without another request. Data is still lost on a full reload.

### 3. Saved cache (`step-3-persist`, `v3-step-3`)

Read `persist.ts` and the provider: `createAsyncStoragePersister`, the `get`/`set`/`del` adapter, `PersistQueryClientProvider`, `maxAge`, and `buster`. Successful queries survive an online reload. The debug pill can identify the restored data. A full offline reload still cannot load the app shell.

### 4. Offline shell (`step-4-pwa`, `v4-step-4`)

The service-worker registration and `public/sw.js` add the missing HTML, JS, CSS, font and image layer. Build before testing. Load the shop, let the worker activate, visit products, go offline and reload. Visited document URLs have dedicated cached HTML; the root shell can also render a product URL from the restored full catalog. All seed images are precached, so this Next adaptation can show an unvisited product if it already exists in the saved full catalog.

### 5. Real offline UX (`step-5-offline-ux`, `v5-step-5`, `main`)

Look at `onlineManager`, catalog version invalidation, `setMutationDefaults(['placeOrder'])`, and `resumePausedMutations()`. The offline banner and update age explain what is happening. Place an order offline: it pauses, persists and resumes after reconnecting, including after an offline reload. A stable request ID prevents duplicate orders if a response was lost. Resumed orders clear the saved cart and show a receipt toast. Price edits on the laptop invalidate phone data after reconnecting. Install through Chrome's button or Safari's Share → Add to Home Screen.

## Vercel

No deployment has been performed. Import the repo into Vercel and select the Next.js preset. Add `ADMIN_KEY`, `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` in project settings. Use the default `npm run build`. Next handles the API and page routing; do not add Vite's `index.html` SPA rewrite. Service workers require HTTPS (localhost is allowed). Do not put admin keys in public environment variables.

## Validation limits

Production build, strict TypeScript, lint, and local API checks are run during development. Browser checks cover desktop/390px layout, shopping, product navigation and checkout. A visited product also reloaded successfully with the local production server stopped; see `VALIDATION.md`. Real airplane-mode behavior, iOS installation and Lighthouse scoring must still be verified on the target phone before recording; those results are not claimed by the source checks. Redis mode needs your own Upstash environment to verify against a live instance.
