# Validation record

- All five branches passed `npm run lint`, `npm run typecheck` and `npm run build`.
- `main`, `step-5-offline-ux` and `v5-step-5` contain the finished app.
- The completed project was started successfully from `/home/derrick/Documents/tutorials-content`.
- API checks passed for twelve seed products, no-store/version headers, admin authentication, price edits/version increments, server-priced orders, idempotent retries, invalid bodies, missing products and reset.
- Browser checks passed for desktop and 390px layouts (no horizontal overflow), category filtering, text search, product navigation, gallery selection, color selection, quantity, add to bag, demo checkout, receipt feedback and cart clearing.
- The browser completed an order totaling GH₵ 3,180; the server reduced inventory correctly.
- With the local production server stopped, a previously visited product page successfully reloaded with its product details and images, demonstrating the service-worker shell and persisted-data layers.

Not verified here: a physical phone's airplane mode/reconnect and queued-order reload sequence, iOS installation, live Upstash concurrency, or Lighthouse scores. The README explains the manual recording checks. This is a demo checkout; no real payment or deployment was performed.
