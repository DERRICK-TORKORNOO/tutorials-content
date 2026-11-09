# Kudi Store · offline shop tutorial

Explore offline-first web development with a Next.js shop, Supabase Postgres and private product image uploads. The dashboard at `/admin` provides product management, live request statistics, orders and network settings. Checkout creates sample orders without taking payment.

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

## Learning path

The repository has two branches:

- `tutorial-1`: a standalone static shop that caches documents, scripts, styles, catalog JSON and images with a service worker. It needs no database or API keys.
- `main`: the complete application with a Supabase backend, admin dashboard, persisted query cache and offline order handling.

### Service-worker caching

The service worker saves the app shell and product images. In this branch, API JSON responses use the network; TanStack Query owns the data cache. This separates the files needed to load the app from the catalog data displayed inside it.

### Query persistence

Successful shop queries are saved in IndexedDB for up to 24 hours. Admin queries are excluded. Add `?debug=1` to the shop URL to inspect whether data came from the network, memory or a restored cache.

### Catalog freshness

The client checks the catalog version at startup, when the tab becomes visible and after reconnection. A changed version invalidates catalog queries. With an unchanged version, the cached catalog stays available without another full download.

### Offline orders

Place an order offline, reload the page, then reconnect. The saved mutation resumes automatically and the received order appears in Admin Orders. A stable request ID prevents duplicate orders if a response is lost.

### Explore changes across devices

Open the shop in one browser and the admin dashboard in another. Disconnect the shop, then edit a price, add a product or archive an item through the dashboard. Reconnect the shop to observe the refreshed catalog and product availability state.

## Deployment

Once your project works locally, import the repository into Vercel using the **Next.js preset** and add the four server environment variables. `npm run build` is the build command. Next handles routing; do not add an `index.html` SPA rewrite. Use separate Vercel deployments for `main` and `tutorial-1` when comparing their behaviour. Service workers need HTTPS or localhost.

The application uses **Next.js** routing, Hono through `hono/vercel`, CSS and a native service worker. Photography is local; category variants share two photo crops. See `public/img/CREDITS.md` and `public/fonts/CREDITS.md`.

## Tests and remaining checks

`make test` uses a test-only PostgreSQL WASM engine (PGlite) to exercise the actual Drizzle repository and Hono routes. The production application cannot select this engine. Storage tests use a test transport to verify Sharp, response caching and cleanup retries. A separate test preview harness is provided for UI QA; it is not a production data fallback.

See `VALIDATION.md` for checks run on this update. Actual Supabase pooler/Storage access, phone airplane-mode/reconnect/install behaviour and Lighthouse scores still need verification after you create and configure your project.

Implementation references: [Supabase transaction pooling](https://supabase.com/docs/guides/database/connecting-to-postgres), [prepared statements](https://supabase.com/kb/troubleshooting/disabling-prepared-statements-qL8lEL), [private Storage access](https://supabase.com/docs/guides/storage/security/access-control), [Hono with Next.js](https://hono.dev/docs/getting-started/nextjs), [Drizzle transactions](https://orm.drizzle.team/docs/transactions).
