import { readFile, writeFile, mkdir } from "node:fs/promises";
import { createHash } from "node:crypto";
import { seedProducts, seedCategories } from "../api/db/seed";
const quote = (value: unknown) =>
  value === null || value === undefined
    ? "NULL"
    : typeof value === "number"
      ? String(value)
      : typeof value === "boolean"
        ? String(value)
        : `'${String(value).replaceAll("'", "''")}'`;
async function run() {
  const journal = JSON.parse(
    await readFile("api/db/migrations/meta/_journal.json", "utf8"),
  ) as { entries: { tag: string; when: number }[] };
  const blocks = [
    "-- Kudi Store: paste ONCE into a new Supabase project SQL Editor.\n-- Creates tables with RLS enabled and no public policies, seed data and a PRIVATE image bucket.\nBEGIN;",
    "CREATE SCHEMA IF NOT EXISTS drizzle;",
    "CREATE TABLE IF NOT EXISTS drizzle.__drizzle_migrations (id SERIAL PRIMARY KEY, hash text NOT NULL, created_at bigint);",
  ];
  for (const entry of journal.entries) {
    const content = await readFile(
      `api/db/migrations/${entry.tag}.sql`,
      "utf8",
    );
    blocks.push(content.replaceAll("--> statement-breakpoint", ""));
    blocks.push(
      `INSERT INTO drizzle.__drizzle_migrations(hash, created_at) VALUES (${quote(createHash("sha256").update(content).digest("hex"))}, ${entry.when});`,
    );
  }
  blocks.push(
    "INSERT INTO settings(id,catalog_version,slow_mode) VALUES (1,1,0) ON CONFLICT(id) DO NOTHING;",
  );
  blocks.push(
    `INSERT INTO categories(slug,name) VALUES ${seedCategories.map((c) => `(${quote(c.slug)},${quote(c.name)})`).join(",\n")} ON CONFLICT DO NOTHING;`,
  );
  const fields = [
    "slug",
    "name",
    "category",
    "price_cents",
    "rating_tenths",
    "review_count",
    "stock",
    "badge",
    "description",
    "images",
    "colors",
    "featured",
  ];
  blocks.push(
    `INSERT INTO products(${fields.join(",")}) VALUES ${seedProducts.map((p) => `(${[p.slug, p.name, p.category, p.priceCents, p.rating, p.reviewCount, p.stock, p.badge, p.description, JSON.stringify(p.images), JSON.stringify(p.colors), p.featured].map(quote).join(",")})`).join(",\n")} ON CONFLICT DO NOTHING;`,
  );
  blocks.push(
    "INSERT INTO storage.buckets (id,name,public,file_size_limit,allowed_mime_types) VALUES ('product-images','product-images',false,5242880,ARRAY['image/webp']) ON CONFLICT(id) DO UPDATE SET public=false, file_size_limit=5242880, allowed_mime_types=ARRAY['image/webp'];",
    "COMMIT;",
  );
  await mkdir("supabase", { recursive: true });
  await writeFile("supabase/setup.sql", blocks.join("\n\n") + "\n");
  console.log(
    "Generated supabase/setup.sql — schema, migration ledger, seed and private bucket.",
  );
}
run().catch((error) => {
  console.error(
    error instanceof Error ? error.message : "Could not generate SQL.",
  );
  process.exitCode = 1;
});
