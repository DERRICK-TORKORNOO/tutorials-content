# Tutorial 1 validation

- Lint, strict TypeScript and production static export passed.
- All 12 catalog products have their own exported document and are included in precaching.
- All 130 generated precache URLs returned HTTP 200 from the production preview.
- Four service-worker tests passed: offline documents/JSON/images/scripts; unvisited product paths with queries/trailing slashes; offline fallback and write exclusion; old-cache cleanup while preserving unrelated caches.
- No TanStack Query, IndexedDB persister, database driver, Supabase configuration, admin dashboard, product-version polling or queued-order code is part of this branch.
- Automated worker tests simulate an unavailable origin. Device-level checks should also cover airplane mode, page reloads and opening product links after the cache is ready.
