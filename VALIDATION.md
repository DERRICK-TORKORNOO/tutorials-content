# Validation · Supabase edition

The integration suite runs against a test-only PostgreSQL engine. Live-service verification requires a configured Supabase project.

The complete application is on `main`. The independent service-worker example is on `tutorial-1`.

## Automated coverage

The actual Drizzle repository and Hono API are exercised with test-only PostgreSQL WASM (PGlite). There is no application memory fallback.

- Initial migration and non-destructive seeding.
- Ready-to-paste Supabase setup SQL, private bucket settings, migration ledger compatibility and subsequent CLI migrations.
- Public product summaries, featured seeds, no-store/version headers and exact catalog-only request counting.
- Unauthorized admin operations rejected before database access.
- Category/product creation, unique generated slugs and per-field validation errors.
- Product editing, archiving, exclusion from public lists and restoration, with version increments.
- Server-priced checkout, inventory updates, delayed-order labels, stable idempotency, mismatched retry rejection and rollback on insufficient stock.
- Image format verification, 1200px WebP conversion, same-origin immutable reads and rejection of forged images.
- Reset plus retryable image cleanup after a simulated Storage failure.
- RLS prevents an unprivileged role from reading store rows.

## Browser and build checks

- Desktop and 390px admin layouts checked; tables scroll within their panels without widening the page.
- Test-only preview verified sign-in, live overview, inline price save, product form validation, two-image upload/previews/reorder, product creation, archive confirmation, restore, and the delayed-order label.
- Production build and client-bundle secret scan passed; the fake build-time service-role sentinel was absent from browser assets.
- A 4.95 MB source image was saved through a test proxy enforcing a 4.5 MB request limit, verifying browser preparation before the API upload.
- The unconfigured production API returned the documented 503 `SETUP_REQUIRED` response.
- `make help`, schema generation and SQL export were exercised without any Supabase credentials.

## Limitations

Live Supabase pooler connections and Storage REST permissions require a configured project. A local SQL engine cannot verify those external services. Real-phone airplane-mode/reconnect and offline order reload, iOS installation and Lighthouse scoring remain manual checks after configuration. No score or live cloud result is claimed.
