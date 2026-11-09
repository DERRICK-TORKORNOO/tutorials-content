# Kudi Store · offline shop tutorial

A Next.js shop with a full store admin, Supabase Postgres, private product image uploads, and five offline-caching milestones. The original forest-green storefront stays; the control room at `/admin` adds product management, live requests, orders and demo settings. Checkout is a demo and never takes payment.

**You can install, build and test the code before creating a Supabase account.** The running shop needs your database configuration. It deliberately has no Redis or in-memory application fallback.

## Start here when you create your Supabase account

### 1. Create a free Supabase project

Create a project and keep the database password. Wait for provisioning to finish. No Supabase Auth setup, frontend anon key, or browser Supabase client is required.

### 2. Set up the schema, seed and image bucket

Choose **one** route:

**Easiest: Supabase SQL Editor**

1. Open `supabase/setup.sql` from this repository.
2. Paste the whole file into a new query in your project's SQL Editor and run it **once on a new project**.
3. It creates six tables, enables row-level security with no public policies, inserts 12 products/4 categories, creates the private `product-images` bucket, and records the applied migration in Drizzle's ledger.
4. Run `supabase/verify.sql` to inspect the tables, seed counts, bucket privacy and RLS state.

You can subsequently use the CLI migration commands: the ledger prevents reapplying the initial migration. The full setup SQL is a new-project bootstrap, not a replacement for incremental migrations on an existing database.

**Or: command line migrations**

Configure `.env.local` as below, then run:

```sh
make db-setup
```

This applies the checked-in migrations and seeds missing rows. Separately create a **private** Storage bucket named `product-images` in the Supabase dashboard, or run `supabase/bucket.sql` in the SQL Editor. Keep it private; the API serves the photos from your own origin. Only WebP is stored; uploads are converted on the server.

### 3. Add your server environment

```sh
cp .env.example .env.local
```

Edit `.env.local`:

```dotenv
ADMIN_KEY=your-own-long-random-admin-key
DATABASE_URL=postgresql://postgres.PROJECT_REF:ENCODED_PASSWORD@aws-0-REGION.pooler.supabase.com:6543/postgres
SUPABASE_URL=https://PROJECT_REF.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-server-only-service-role-key
```

Copy the **transaction pooler** connection string from Supabase's Connect panel; use port **6543**. URL-encode special characters in the database password. The `postgres` driver uses TLS and `prepare: false` for transaction pooling. The service-role key is a server credential, not the anon/publishable key. Never prefix any of these credentials with `NEXT_PUBLIC_` or `VITE_`, commit `.env.local`, or paste them into frontend code.

The service-role credential is used only by the server's Storage REST calls. The browser calls our Hono API. Tables have RLS enabled without public policies; the server connects using your privileged database connection. Do not add public read policies for this demo.

### 4. Run the site

Requires Node.js 22+ and npm. GNU Make is optional; every command has an npm equivalent.

```sh
make install
make dev
```

Open http://localhost:3000. Admin: http://localhost:3000/admin. Sign in with the `ADMIN_KEY` you chose. The key is retained only in sessionStorage; Sign out clears it and the in-memory admin query cache. `/stats` redirects to `/admin` for old bookmarks. The admin is not linked from the shop UI.

## Makefile commands

| Command                                               | What it does                                                                           |
| ----------------------------------------------------- | -------------------------------------------------------------------------------------- |
| `make help`                                           | Show available commands                                                                |
| `make install`                                        | Install from package-lock.json                                                         |
| `make dev`                                            | Run Next.js and the API together                                                       |
| `make build`                                          | Production build and offline asset manifest                                            |
| `make preview`                                        | Serve that production build                                                            |
| `make check`                                          | Lint, strict TypeScript, database/API tests                                            |
| `make test`                                           | Integration tests; no Supabase account needed                                          |
| `make format`                                         | Format the source                                                                      |
| `make db-schema` / `make db-generate` / `make schema` | Generate an incremental SQL migration from `api/db/schema.ts`; no live database needed |
| `make db-sql` / `make sql`                            | Regenerate `supabase/setup.sql` for a new Supabase project                             |
| `make db-migrate` / `make migrate`                    | Apply pending migrations using `.env.local`                                            |
| `make db-seed` / `make seed`                          | Insert missing seed rows without overwriting existing products                         |
| `make db-setup`                                       | Run migrations, then seed                                                              |
| `make db-studio`                                      | Open Drizzle Studio against your configured database                                   |

Npm equivalents: `npm run dev`, `build`, `preview`, `lint`, `typecheck`, `test`, `format`, `db:generate`, `db:migrate`, `db:seed`, `db:sql`.

### Change the schema later

Edit `api/db/schema.ts`, run `make db-schema`, review and commit the generated files in `api/db/migrations`, then run `make db-migrate`. Run `make db-sql` if you also want the new-project SQL bootstrap regenerated. Migrations are checked in. Seeding is safe to repeat; **Reset demo data** in Admin Settings intentionally removes custom products, orders, stats and uploads, then restores seed data and increments the catalog version.

## The control room

- **Overview:** a large live request count, endpoint breakdown, request feed with phone/laptop tags and new-row highlights, catalog version, last five orders. Polls every second.
- **Products:** search, live/archived tabs, inline price/stock editing (Enter saves, Escape cancels), create/edit form, dynamic categories, featured flag, four-image upload with previews, drag reorder and accessible arrow controls. Archive asks for confirmation; Restore brings the same slug back.
- **Orders:** last 20 received orders, server-calculated totals, received timestamps. A delay over 10 seconds between client `createdAt` and server `receivedAt` is labelled “Placed offline”; this is a timing heuristic, not proof of network status.
- **Settings:** slow mode for catalog endpoints only, clear stats, confirmed demo reset, and retryable image cleanup if Storage was unavailable during reset.

All admin query keys begin with `['admin', ...]` and are excluded from IndexedDB persistence. Admin catalog management reads use `/api/v1/admin/*`; watching the dashboard does not increment shop hit counts. Admin actions run immediately and are not queued offline.

## Backend and files

- `api/app.ts`: Hono API mounted in the Next.js route handler.
- `api/db/schema.ts`: Drizzle schema. `api/db/migrations/`: versioned SQL and migration metadata.
- `api/db/seed.ts`: the 12 seed products and 4 categories.
- `api/db/repository.ts`: Postgres reads, short transactions and shared state.
- `api/storage.ts`: server-only private bucket upload/download/delete transport.
- `api/validation.ts`: shared Zod product, order and parameter validation.
- `src/components/admin/`: dashboard, form and reusable UI states.
- `src/hooks/useCatalog.ts`, `src/lib/api.ts`, `queryClient.ts`, `persist.ts`: catalog requests and caching.
- `public/sw.js`, `scripts/build-sw.mjs`: offline documents/static files and image caching.
- `scripts/export-sql.ts`, `supabase/setup.sql`: SQL Editor bootstrap generator and ready-to-paste output.

Prices are stored as integer pesewas and totals are computed on the server. A shared settings-row lock serializes catalog writes and stock changes across serverless instances. Orders use an idempotency key and request fingerprint, so retrying the same queued order cannot create a second order or decrement stock twice; reusing a key with different items is rejected.

Reset commits the catalog reset and marks uploads for deletion in the database first. It then removes Storage objects in batches. If Storage fails, the reset remains committed and its pending cleanup can be retried from Settings; the UI and API report that partial outcome.

The product list deliberately sends summaries. Product details use a summary as a fast placeholder, then fetch full description/colours. A summary is not treated as a fully cached detail page.

## API

All endpoints are below `/api/v1`. JSON responses carry `Cache-Control: no-store` and `X-Catalog-Version`. Uploaded image responses are the sole immutable-cache exception. A missing database is an explicit 503 setup error; it does not silently serve demo memory data. Unauthorized admin requests are rejected before database access and carry version `0` when a catalog version has not been read.

Public: `GET products`, `products/:slug`, `categories`, `meta/version`, `stats`, `orders`; `POST cart`; `GET images/:key`.

Admin header: `x-admin-key`. Admin endpoints: `GET admin/session`, `admin/overview`, `admin/products`, `admin/categories`, `admin/orders`, `admin/settings`; `POST admin/products`, `admin/categories`, `admin/images`, `admin/products/:slug/restore`, `admin/slow-mode`, `admin/reset`, `admin/stats/clear`, `admin/images/cleanup`; `PATCH admin/products/:slug`; `DELETE admin/products/:slug`.

Uploads accept one multipart `file` (JPEG/PNG/WebP, max 5 MB); Sharp verifies and converts it to WebP, rotates correctly and limits width to 1200px. Up to four resulting same-origin image URLs may be assigned to a product. Source files up to 5 MB are accepted in the form; files over 4 MB are resized in the browser before transport to fit [Vercel’s 4.5 MB request limit](https://vercel.com/docs/functions/limitations). The server still verifies and converts every upload. Direct API clients must respect their hosting provider’s request limit. Archived products return 404 publicly and render “This product is no longer available” with a return-to-shop link.

## Five tutorial branches

`main` equals `step-5-offline-ux`. The previous Redis edition is preserved under `legacy/step-*` branches and `legacy-v*-step-*` tags. The active milestones all use this Supabase backend/admin.

### 1 · `step-1-fetch` / `v1-step-1`

`useCatalog.ts` uses `useEffect` and local state. Every catalog screen mount makes a request. Visit a product, go back and visit again; watch the admin counter rise. With no network, uncached pages fail. Next.js router prefetch can affect navigation; use full page navigations for the simplest filming comparison.

### 2 · `step-2-tanstack` / `v2-step-2`

```ts
const catalog = useQuery({ queryKey: ['products', {}], queryFn: loadProducts });
// Reuse recently fetched data while navigating.
staleTime: 60_000,
// Keep visited queries in memory for a day.
gcTime: 86_400_000,
// Avoid a long retry loop while demonstrating a failure.
retry: 1,
```

Navigate back within a minute and watch the request count stay stable. Details can show list summary placeholders immediately but still need their full response. Reloading loses the in-memory data.

### 3 · `step-3-persist` / `v3-step-3`

```tsx
<PersistQueryClientProvider
  client={client}
  persistOptions={{
    persister,
    maxAge: 86_400_000,
    buster: process.env.NEXT_PUBLIC_APP_VERSION,
    dehydrateOptions: {
      shouldDehydrateQuery: (q) =>
        q.state.status === "success" && q.queryKey[0] !== "admin",
    },
  }}
/>
```

Successful shop queries survive an online reload. Admin queries never enter IndexedDB. Use `?debug=1` to see the source label. A full offline reload still cannot load the app shell at this stage.

### 4 · `step-4-pwa` / `v4-step-4`

```js
// Check product images before the generic API rule.
if (path.startsWith("/img/products/") || path.startsWith("/api/v1/images/")) {
  // CacheFirst; product-images cache; 100 entries; 30-day expiry.
}
// Every other API response is NetworkOnly.
if (path.startsWith("/api/")) return;
```

Build and preview. Load the shop, visit product details, wait for the worker to activate, then go offline and reload the visited URL. The HTML/JS/CSS/fonts come from the shell cache, viewed images from the image cache, and data from IndexedDB. Unvisited full product details are not promised offline. Admin pages require a connection and are not document-cached.

### 5 · `step-5-offline-ux` / `v5-step-5` / `main`

```ts
client.setMutationDefaults(["placeOrder"], { mutationFn: placeOrder });
// In persistence restoration's onSuccess:
void client.resumePausedMutations();
// The order variables include a stable requestId and client-created timestamp.
order.mutate({ items, requestId, createdAt });
```

Catalog freshness uses version checks on start, visibility and reconnection rather than elapsed time. Existing data shows its update age. The offline banner and install affordances explain the state. Queue an order offline, reload, reconnect and watch it arrive in Admin Orders; a delayed order receives the timing label. Change a price or archive a product on the laptop while the phone is offline; the phone updates on reconnection. New products/categories appear after invalidation. Old cache shapes are dropped when the app version changes; finish any queued v1 orders before upgrading.

## Deployment

No deployment or Supabase account has been created. Once your own project works locally, import the repository into Vercel using the **Next.js preset** and add the four server environment variables. `npm run build` is the build command. Next handles routing; do not add an `index.html` SPA rewrite. Each tutorial branch can have its own Vercel preview URL. Service workers need HTTPS or localhost.

This retains your requested **Next.js** implementation. Hono is mounted through `hono/vercel` in a Next Route Handler; Vite/React Router and vite-plugin-pwa are replaced with Next routing and the native service worker. Styling remains CSS rather than Tailwind. Photography is local; category variants share two photo crops. See `public/img/CREDITS.md` and `public/fonts/CREDITS.md`.

## Tests and remaining checks

`make test` uses a test-only PostgreSQL WASM engine (PGlite) to exercise the actual Drizzle repository and Hono routes. The production application cannot select this engine. Storage tests use a test transport to verify Sharp, response caching and cleanup retries. A separate test preview harness is provided for UI QA; it is not a production data fallback.

See `VALIDATION.md` for checks run on this update. Actual Supabase pooler/Storage access, phone airplane-mode/reconnect/install behaviour and Lighthouse scores still need verification after you create and configure your project.

Implementation references: [Supabase transaction pooling](https://supabase.com/docs/guides/database/connecting-to-postgres), [prepared statements](https://supabase.com/kb/troubleshooting/disabling-prepared-statements-qL8lEL), [private Storage access](https://supabase.com/docs/guides/storage/security/access-control), [Hono with Next.js](https://hono.dev/docs/getting-started/nextjs), [Drizzle transactions](https://orm.drizzle.team/docs/transactions).
