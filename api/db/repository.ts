import { randomUUID, createHash } from "node:crypto";
import { and, eq, isNull, desc, sql, count, inArray } from "drizzle-orm";
import type { Database } from "./client";
import * as tables from "./schema";
import { seedCategories, seedProducts, slugify } from "./seed";
import type { Product, Order, StatsData } from "../../src/lib/products";
import type { ProductInput, cartInput } from "../validation";
import type { z } from "zod";
import { AppError } from "../errors";
type Transaction = Parameters<Parameters<Database["transaction"]>[0]>[0];
const { products, categories, settings, orders, requestLog, uploadedImages } =
  tables;
const mapProduct = (row: typeof products.$inferSelect): Product => ({
  slug: row.slug,
  name: row.name,
  category: row.category,
  price: row.priceCents / 100,
  currency: row.currency,
  rating: row.rating / 10,
  reviewCount: row.reviewCount,
  stock: row.stock,
  badge: row.badge ?? undefined,
  description: row.description,
  images: row.images,
  colors: row.colors,
  featured: row.featured,
  archivedAt: row.archivedAt,
  createdAt: row.createdAt,
  updatedAt: row.updatedAt,
});
const mapOrder = (row: typeof orders.$inferSelect): Order => ({
  orderRef: row.orderRef,
  items: row.items,
  total: row.totalCents / 100,
  createdAt: row.createdAt,
  receivedAt: row.receivedAt,
  placedOffline: Date.parse(row.receivedAt) - Date.parse(row.createdAt) > 10000,
});
const writeFields = (input: Partial<ProductInput>) => {
  const { price, ...rest } = input;
  return {
    ...rest,
    ...(price === undefined ? {} : { priceCents: Math.round(price * 100) }),
    updatedAt: new Date().toISOString(),
  };
};
export function createRepository(db: Database) {
  async function getSettings() {
    const [row] = await db.select().from(settings).where(eq(settings.id, 1));
    if (!row)
      throw new AppError(
        "SETUP_REQUIRED",
        "Run the database migrations and seed first.",
        503,
      );
    return row;
  }
  // One short row lock serializes catalog changes across serverless instances.
  async function catalogWrite<T>(
    work: (tx: Transaction) => Promise<T>,
    bump = true,
  ) {
    return db.transaction(async (tx) => {
      const [state] = await tx
        .select()
        .from(settings)
        .where(eq(settings.id, 1))
        .for("update");
      if (!state)
        throw new AppError(
          "SETUP_REQUIRED",
          "Run the database migrations and seed first.",
          503,
        );
      const value = await work(tx);
      const [updated] = await tx
        .update(settings)
        .set({
          catalogVersion: bump
            ? sql`${settings.catalogVersion}+1`
            : state.catalogVersion,
          updatedAt: new Date().toISOString(),
        })
        .where(eq(settings.id, 1))
        .returning();
      return { value, catalogVersion: updated.catalogVersion };
    });
  }
  async function validateImages(tx: Transaction, images?: string[]) {
    if (!images) return;
    const keys = images
      .filter((s) => s.startsWith("/api/v1/images/"))
      .map((s) => s.split("/").pop()!);
    if (!keys.length) return;
    const existing = await tx
      .select()
      .from(uploadedImages)
      .where(
        and(
          inArray(uploadedImages.key, keys),
          eq(uploadedImages.cleanupPending, false),
        ),
      );
    if (existing.length !== new Set(keys).size)
      throw new AppError(
        "INVALID_IMAGES",
        "One of these images is no longer available. Upload it again.",
        400,
        { images: "Upload the missing image again." },
      );
  }
  async function listProducts(includeArchived = false, category?: string) {
    const rows = await db
      .select()
      .from(products)
      .where(
        and(
          includeArchived ? undefined : isNull(products.archivedAt),
          category ? eq(products.category, category) : undefined,
        ),
      )
      .orderBy(products.createdAt, products.slug);
    return rows.map(mapProduct);
  }
  async function listCategories() {
    const rows = await db
      .select({
        slug: categories.slug,
        name: categories.name,
        count: count(products.slug),
      })
      .from(categories)
      .leftJoin(
        products,
        and(
          eq(products.category, categories.name),
          isNull(products.archivedAt),
        ),
      )
      .groupBy(categories.slug, categories.name)
      .orderBy(categories.createdAt, categories.name);
    return rows;
  }
  async function listOrders() {
    return (
      await db.select().from(orders).orderBy(desc(orders.receivedAt)).limit(20)
    ).map(mapOrder);
  }
  async function stats(): Promise<StatsData> {
    const [total] = await db.select({ count: count() }).from(requestLog);
    const by = await db
      .select({ path: requestLog.path, count: count() })
      .from(requestLog)
      .groupBy(requestLog.path);
    const recent = await db
      .select()
      .from(requestLog)
      .orderBy(desc(requestLog.id))
      .limit(50);
    return {
      total: total.count,
      byPath: Object.fromEntries(by.map((r) => [r.path, r.count])),
      recent,
    };
  }
  return {
    getSettings,
    listProducts,
    listCategories,
    listOrders,
    stats,
    async product(slug: string) {
      const [row] = await db
        .select()
        .from(products)
        .where(and(eq(products.slug, slug), isNull(products.archivedAt)));
      if (!row)
        throw new AppError(
          "NOT_FOUND",
          "This product is no longer available.",
          404,
        );
      return mapProduct(row);
    },
    async log(entry: Omit<typeof requestLog.$inferInsert, "id" | "time">) {
      await db.insert(requestLog).values(entry);
    },
    async createProduct(input: ProductInput) {
      return catalogWrite(async (tx) => {
        await validateImages(tx, input.images);
        const [category] = await tx
          .select()
          .from(categories)
          .where(eq(categories.name, input.category));
        if (!category)
          throw new AppError(
            "INVALID_CATEGORY",
            "Choose an existing category.",
            400,
            { category: "Create this category first." },
          );
        const base = slugify(input.name);
        if (!base)
          throw new AppError(
            "INVALID_NAME",
            "Include letters or numbers in the product name.",
            400,
            { name: "Include letters or numbers." },
          );
        let slug = base;
        let suffix = 1;
        while (
          (
            await tx
              .select({ slug: products.slug })
              .from(products)
              .where(eq(products.slug, slug))
          ).length
        )
          slug = `${base}-${++suffix}`;
        const [row] = await tx
          .insert(products)
          .values({
            ...writeFields(input),
            name: input.name,
            category: input.category,
            priceCents: Math.round(input.price * 100),
            stock: input.stock,
            description: input.description,
            images: input.images,
            slug,
          })
          .returning();
        return mapProduct(row);
      });
    },
    async editProduct(slug: string, input: Partial<ProductInput>) {
      return catalogWrite(async (tx) => {
        await validateImages(tx, input.images);
        if (input.category) {
          const [category] = await tx
            .select()
            .from(categories)
            .where(eq(categories.name, input.category));
          if (!category)
            throw new AppError(
              "INVALID_CATEGORY",
              "Choose an existing category.",
              400,
              { category: "Create this category first." },
            );
        }
        const [row] = await tx
          .update(products)
          .set(writeFields(input))
          .where(eq(products.slug, slug))
          .returning();
        if (!row) throw new AppError("NOT_FOUND", "Product not found.", 404);
        return mapProduct(row);
      });
    },
    async archiveProduct(slug: string, restore = false) {
      return catalogWrite(async (tx) => {
        const [row] = await tx
          .update(products)
          .set({
            archivedAt: restore ? null : new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          })
          .where(eq(products.slug, slug))
          .returning();
        if (!row) throw new AppError("NOT_FOUND", "Product not found.", 404);
        return mapProduct(row);
      });
    },
    async createCategory(name: string) {
      return catalogWrite(async (tx) => {
        const slug = slugify(name);
        if (!slug)
          throw new AppError(
            "INVALID_NAME",
            "Include letters or numbers in the category.",
            400,
          );
        const [existing] = await tx
          .select()
          .from(categories)
          .where(eq(categories.slug, slug));
        if (existing)
          throw new AppError("CONFLICT", "That category already exists.", 409);
        const [row] = await tx
          .insert(categories)
          .values({ name, slug })
          .returning();
        return { ...row, count: 0 };
      });
    },
    async checkout(input: z.infer<typeof cartInput>) {
      const requestId = input.requestId ?? randomUUID();
      const fingerprint = createHash("sha256")
        .update(
          JSON.stringify({
            items: input.items,
            createdAt: input.createdAt ?? null,
          }),
        )
        .digest("hex");
      return db.transaction(async (tx) => {
        const [state] = await tx
          .select()
          .from(settings)
          .where(eq(settings.id, 1))
          .for("update");
        if (!state)
          throw new AppError(
            "SETUP_REQUIRED",
            "Run migrations and seed first.",
            503,
          );
        const [old] = await tx
          .select()
          .from(orders)
          .where(eq(orders.requestId, requestId));
        if (old) {
          if (old.fingerprint !== fingerprint)
            throw new AppError(
              "CONFLICT",
              "This request ID has already been used for a different order.",
              409,
            );
          return { value: mapOrder(old), catalogVersion: state.catalogVersion };
        }
        const rows = await tx
          .select()
          .from(products)
          .where(
            inArray(
              products.slug,
              input.items.map((i) => i.slug),
            ),
          );
        let totalCents = 0;
        const lines = input.items.map((item) => {
          const row = rows.find((p) => p.slug === item.slug);
          if (!row || row.archivedAt)
            throw new AppError(
              "PRODUCT_UNAVAILABLE",
              "A product in your bag is no longer available. Remove it and try again.",
              409,
            );
          if (row.stock < item.qty)
            throw new AppError(
              "OUT_OF_STOCK",
              `${row.name} has only ${row.stock} available.`,
              409,
            );
          totalCents += row.priceCents * item.qty;
          return {
            slug: row.slug,
            name: row.name,
            qty: item.qty,
            unitPrice: row.priceCents / 100,
          };
        });
        for (const line of lines)
          await tx
            .update(products)
            .set({
              stock: sql`${products.stock}-${line.qty}`,
              updatedAt: new Date().toISOString(),
            })
            .where(eq(products.slug, line.slug));
        const receivedAt = new Date().toISOString();
        const [order] = await tx
          .insert(orders)
          .values({
            orderRef: `KD-${randomUUID().slice(0, 12).toUpperCase()}`,
            requestId,
            fingerprint,
            items: lines,
            totalCents,
            createdAt: input.createdAt ?? receivedAt,
            receivedAt,
          })
          .returning();
        const [version] = await tx
          .update(settings)
          .set({
            catalogVersion: sql`${settings.catalogVersion}+1`,
            updatedAt: receivedAt,
          })
          .where(eq(settings.id, 1))
          .returning();
        return {
          value: mapOrder(order),
          catalogVersion: version.catalogVersion,
        };
      });
    },
    async setSlowMode(ms: number) {
      await db.update(settings).set({ slowMode: ms }).where(eq(settings.id, 1));
    },
    async clearStats() {
      await db.delete(requestLog);
    },
    async registerImage(key: string) {
      await catalogWrite(async (tx) => {
        await tx.insert(uploadedImages).values({ key });
      }, false);
    },
    async pendingImages() {
      return db
        .select()
        .from(uploadedImages)
        .where(eq(uploadedImages.cleanupPending, true));
    },
    async imageExists(key: string) {
      const [row] = await db
        .select()
        .from(uploadedImages)
        .where(
          and(
            eq(uploadedImages.key, key),
            eq(uploadedImages.cleanupPending, false),
          ),
        );
      return !!row;
    },
    async removedImages(keys: string[]) {
      if (keys.length)
        await db
          .delete(uploadedImages)
          .where(
            and(
              inArray(uploadedImages.key, keys),
              eq(uploadedImages.cleanupPending, true),
            ),
          );
    },
    async reset() {
      return catalogWrite(async (tx) => {
        await tx.delete(orders);
        await tx.delete(requestLog);
        await tx.delete(products);
        await tx.delete(categories);
        await tx.insert(categories).values(seedCategories);
        await tx.insert(products).values(seedProducts);
        await tx
          .update(settings)
          .set({ slowMode: 0 })
          .where(eq(settings.id, 1));
        await tx.update(uploadedImages).set({ cleanupPending: true });
        return { ok: true };
      });
    },
  };
}
export type Repository = ReturnType<typeof createRepository>;
