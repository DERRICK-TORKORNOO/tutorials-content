import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import sharp from "sharp";
import { createApp } from "../api/app";
import { createRepository } from "../api/db/repository";
import { seedDatabase } from "../api/db/seed";
import type { Database } from "../api/db/client";
import type { ImageStorage } from "../api/storage";
import type { Product, Order, StatsData } from "../src/lib/products";
import * as schema from "../api/db/schema";
const ADMIN = "test-only-admin-key";
process.env.ADMIN_KEY = ADMIN;
test("Postgres schema, catalog lifecycle, authentication and checkout", async (t) => {
  const pg = new PGlite();
  const db = drizzle(pg, { schema });
  // Test-only PostgreSQL engine. The application always uses postgres-js + Supabase.
  const repository = createRepository(db as unknown as Database);
  await migrate(db, { migrationsFolder: "api/db/migrations" });
  await seedDatabase(db as unknown as Database);
  const objects = new Map<string, Uint8Array>();
  let failCleanup = false;
  const storage: ImageStorage = {
    upload: async (key, bytes) => {
      objects.set(key, bytes);
    },
    download: async (key) => new Response(new Uint8Array(objects.get(key)!)),
    remove: async (keys) => {
      if (failCleanup) throw Error("Storage temporarily unavailable");
      keys.forEach((key) => objects.delete(key));
    },
  };
  const app = createApp(
    () => repository,
    () => storage,
  );
  async function request(
    path: string,
    method = "GET",
    body?: unknown,
    admin = false,
  ) {
    return app.request(`/api/v1/${path}`, {
      method,
      headers: {
        "Content-Type": "application/json",
        ...(admin ? { "x-admin-key": ADMIN } : {}),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
  }
  async function version() {
    return (await (await request("meta/version")).json())
      .catalogVersion as number;
  }
  await t.test(
    "public summaries, no-store/version headers and exact hit accounting",
    async () => {
      const r = await request("products");
      assert.equal(r.status, 200);
      assert.equal(r.headers.get("Cache-Control"), "no-store");
      assert.equal(r.headers.get("X-Catalog-Version"), "1");
      const products = await r.json();
      assert.equal(products.length, 12);
      assert.equal(products.filter((p: Product) => p.featured).length, 4);
      assert.equal("description" in products[0], false);
      const stats = (await (await request("stats")).json()) as StatsData;
      assert.equal(stats.total, 1);
      await request("admin/overview", "GET", undefined, true);
      await request("admin/products", "GET", undefined, true);
      await request("meta/version");
      assert.equal((await (await request("stats")).json()).total, 1);
    },
  );
  await t.test(
    "all admin writes reject missing keys before touching the database",
    async () => {
      const missing = createApp(() => {
        throw Error("Must never open database for unauthorized requests");
      });
      for (const [path, method] of [
        ["products", "GET"],
        ["products", "POST"],
        ["products/everyday-runner", "PATCH"],
        ["products/everyday-runner", "DELETE"],
        ["products/everyday-runner/restore", "POST"],
        ["categories", "POST"],
        ["images", "POST"],
        ["reset", "POST"],
        ["slow-mode", "POST"],
        ["stats/clear", "POST"],
      ]) {
        const r = await missing.request(`/api/v1/admin/${path}`, { method });
        assert.equal(r.status, 401);
        assert.equal(r.headers.get("Cache-Control"), "no-store");
      }
    },
  );
  let slug = "";
  await t.test(
    "create category and unique product slugs, validate fields and feature flags",
    async () => {
      const previous = await version();
      assert.equal(
        (await request("admin/categories", "POST", { name: "Travel" }, true))
          .status,
        201,
      );
      const body = {
        name: "Weekend Kit",
        category: "Travel",
        price: 249.95,
        stock: 5,
        description: "A considered carry for your everyday travel.",
        images: ["/img/products/bag.webp"],
        colors: ["#123456"],
        featured: true,
      };
      const first = await request("admin/products", "POST", body, true);
      assert.equal(first.status, 201);
      slug = (await first.json()).product.slug;
      const second = await (
        await request("admin/products", "POST", body, true)
      ).json();
      assert.notEqual(second.product.slug, slug);
      assert.equal(await version(), previous + 3);
      const invalid = await request(
        "admin/products",
        "POST",
        { ...body, price: -4 },
        true,
      );
      assert.equal(invalid.status, 400);
      assert.ok((await invalid.json()).error.fields.price);
      assert.equal(await version(), previous + 3);
    },
  );
  await t.test(
    "edit, archive, exclude from the public shop, then restore",
    async () => {
      const old = await version();
      const before = await (await request(`products/${slug}`)).json();
      const edited = await request(
        `admin/products/${slug}`,
        "PATCH",
        { name: "The Travel Kit", price: 270.25, stock: 7 },
        true,
      );
      assert.equal(edited.status, 200);
      const result = await edited.json();
      assert.equal(result.product.price, 270.25);
      assert.equal(result.product.featured, before.featured);
      assert.deepEqual(result.product.colors, before.colors);
      assert.equal(result.product.badge, before.badge);
      assert.equal(
        (await request(`admin/products/${slug}`, "PATCH", {}, true)).status,
        400,
      );
      assert.equal(
        (await request(`admin/products/${slug}`, "DELETE", undefined, true))
          .status,
        200,
      );
      assert.equal((await request(`products/${slug}`)).status, 404);
      assert.ok(
        !(await (await request("products")).json()).some(
          (p: Product) => p.slug === slug,
        ),
      );
      assert.ok(
        (
          await (await request("admin/products", "GET", undefined, true)).json()
        ).some((p: Product) => p.slug === slug && p.archivedAt),
      );
      assert.equal(
        (
          await request(
            `admin/products/${slug}/restore`,
            "POST",
            undefined,
            true,
          )
        ).status,
        200,
      );
      assert.equal((await request(`products/${slug}`)).status, 200);
      assert.equal(await version(), old + 3);
    },
  );
  await t.test(
    "server totals, offline timing, idempotency and rollback on invalid stock",
    async () => {
      const createdAt = new Date(Date.now() - 20000).toISOString();
      const input = {
        items: [{ slug, qty: 2 }],
        requestId: "offline-order-001",
        createdAt,
      };
      const old = await version();
      const r = await request("cart", "POST", input);
      assert.equal(r.status, 201);
      const order = (await r.json()) as Order;
      assert.equal(order.total, 540.5);
      assert.equal(order.placedOffline, true);
      assert.equal((await (await request(`products/${slug}`)).json()).stock, 5);
      const retry = await (await request("cart", "POST", input)).json();
      assert.equal(retry.orderRef, order.orderRef);
      assert.equal(await version(), old + 1);
      assert.equal(
        (await request("cart", "POST", { ...input, items: [{ slug, qty: 3 }] }))
          .status,
        409,
      );
      const failed = await request("cart", "POST", {
        items: [{ slug, qty: 99 }],
        requestId: "failed-order",
      });
      assert.equal(failed.status, 409);
      assert.equal(await version(), old + 1);
      assert.equal((await (await request(`products/${slug}`)).json()).stock, 5);
      assert.equal(
        (
          await request("cart", "POST", {
            items: [
              { slug, qty: 1 },
              { slug, qty: 1 },
            ],
          })
        ).status,
        400,
      );
    },
  );
  await t.test(
    "convert uploads to WebP, immutable same-origin reads and reject forged images",
    async () => {
      const png = await sharp({
        create: {
          width: 1600,
          height: 800,
          channels: 3,
          background: "#335844",
        },
      })
        .png()
        .toBuffer();
      const form = new FormData();
      form.append(
        "file",
        new File([new Uint8Array(png)], "product.png", { type: "image/png" }),
      );
      const upload = await app.request("/api/v1/admin/images", {
        method: "POST",
        headers: { "x-admin-key": ADMIN },
        body: form,
      });
      assert.equal(upload.status, 201);
      const { url } = await upload.json();
      const image = await app.request(url);
      assert.equal(image.status, 200);
      assert.match(image.headers.get("Cache-Control")!, /immutable/);
      const metadata = await sharp(
        Buffer.from(await image.arrayBuffer()),
      ).metadata();
      assert.equal(metadata.format, "webp");
      assert.equal(metadata.width, 1200);
      const bad = new FormData();
      bad.append(
        "file",
        new File(["not an image"], "fake.png", { type: "image/png" }),
      );
      assert.equal(
        (
          await app.request("/api/v1/admin/images", {
            method: "POST",
            headers: { "x-admin-key": ADMIN },
            body: bad,
          })
        ).status,
        415,
      );
    },
  );
  await t.test(
    "reset is atomic in Postgres and failed Storage cleanup remains retryable",
    async () => {
      const old = await version();
      failCleanup = true;
      const reset = await request("admin/reset", "POST", undefined, true);
      assert.equal(reset.status, 202);
      assert.equal((await reset.json()).cleanupPending, true);
      assert.equal((await (await request("products")).json()).length, 12);
      assert.equal((await (await request("orders")).json()).length, 0);
      assert.equal(await version(), old + 1);
      assert.equal((await repository.pendingImages()).length, 1);
      failCleanup = false;
      assert.equal(
        (await request("admin/images/cleanup", "POST", undefined, true)).status,
        200,
      );
      assert.equal(objects.size, 0);
      assert.equal((await repository.pendingImages()).length, 0);
      await request("admin/stats/clear", "POST", undefined, true);
      assert.equal((await (await request("stats")).json()).total, 0);
    },
  );
  await t.test(
    "RLS prevents an unprivileged role from selecting store tables",
    async () => {
      await pg.exec(
        "CREATE ROLE kudi_anon; GRANT USAGE ON SCHEMA public TO kudi_anon; GRANT SELECT ON ALL TABLES IN SCHEMA public TO kudi_anon; SET ROLE kudi_anon;",
      );
      try {
        const result = await pg.query("SELECT * FROM products");
        assert.equal(result.rows.length, 0);
      } finally {
        await pg.exec("RESET ROLE");
      }
    },
  );
  await pg.close();
});
test("Supabase SQL Editor setup is complete and tracked by the Drizzle migration ledger", async () => {
  const pg = new PGlite();
  await pg.exec(
    "CREATE SCHEMA storage; CREATE TABLE storage.buckets(id text PRIMARY KEY,name text,public boolean,file_size_limit integer,allowed_mime_types text[]);",
  );
  await pg.exec(await readFile("supabase/setup.sql", "utf8"));
  const rows = await pg.query<{ count: number }>(
    "SELECT count(*)::int AS count FROM products",
  );
  assert.equal(rows.rows[0].count, 12);
  const bucket = await pg.query<{ public: boolean }>(
    "SELECT public FROM storage.buckets",
  );
  assert.equal(bucket.rows[0].public, false);
  const db = drizzle(pg, { schema });
  await migrate(db, { migrationsFolder: "api/db/migrations" });
  await seedDatabase(db as unknown as Database);
  assert.equal(
    (
      await pg.query<{ count: number }>(
        "SELECT count(*)::int AS count FROM products",
      )
    ).rows[0].count,
    12,
  );
  await pg.close();
});
