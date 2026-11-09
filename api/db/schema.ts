import {
  pgTable,
  text,
  integer,
  boolean,
  jsonb,
  timestamp,
  bigserial,
  bigint,
  index,
  check,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
const time = (name: string) =>
  timestamp(name, { withTimezone: true, mode: "string" });
export const categories = pgTable("categories", {
  slug: text("slug").primaryKey(),
  name: text("name").notNull().unique(),
  createdAt: time("created_at").notNull().defaultNow(),
}).enableRLS();
export const products = pgTable(
  "products",
  {
    slug: text("slug").primaryKey(),
    name: text("name").notNull(),
    category: text("category")
      .notNull()
      .references(() => categories.name),
    priceCents: integer("price_cents").notNull(),
    currency: text("currency").notNull().default("GHS"),
    rating: integer("rating_tenths").notNull().default(48),
    reviewCount: integer("review_count").notNull().default(0),
    stock: integer("stock").notNull(),
    badge: text("badge"),
    description: text("description").notNull(),
    images: jsonb("images").$type<string[]>().notNull(),
    colors: jsonb("colors").$type<string[]>().notNull().default([]),
    featured: boolean("featured").notNull().default(false),
    archivedAt: time("archived_at"),
    createdAt: time("created_at").notNull().defaultNow(),
    updatedAt: time("updated_at").notNull().defaultNow(),
  },
  (t) => [
    check("positive_price", sql`${t.priceCents}>0`),
    check("nonnegative_stock", sql`${t.stock}>=0`),
    index("product_category_idx").on(t.category),
  ],
).enableRLS();
export const settings = pgTable(
  "settings",
  {
    id: integer("id").primaryKey().default(1),
    catalogVersion: integer("catalog_version").notNull().default(1),
    slowMode: integer("slow_mode").notNull().default(0),
    updatedAt: time("updated_at").notNull().defaultNow(),
  },
  (t) => [check("singleton_settings", sql`${t.id}=1`)],
).enableRLS();
export const orders = pgTable(
  "orders",
  {
    orderRef: text("order_ref").primaryKey(),
    requestId: text("request_id").notNull().unique(),
    fingerprint: text("fingerprint").notNull(),
    items: jsonb("items")
      .$type<{ slug: string; name: string; qty: number; unitPrice: number }[]>()
      .notNull(),
    totalCents: bigint("total_cents", { mode: "number" }).notNull(),
    createdAt: time("created_at").notNull(),
    receivedAt: time("received_at").notNull().defaultNow(),
  },
  (t) => [index("orders_received_idx").on(t.receivedAt)],
).enableRLS();
export const requestLog = pgTable(
  "request_log",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    time: time("time").notNull().defaultNow(),
    method: text("method").notNull(),
    path: text("path").notNull(),
    ms: integer("ms").notNull(),
    device: text("device").notNull(),
  },
  (t) => [index("request_time_idx").on(t.time)],
).enableRLS();
export const uploadedImages = pgTable("uploaded_images", {
  key: text("key").primaryKey(),
  cleanupPending: boolean("cleanup_pending").notNull().default(false),
  createdAt: time("created_at").notNull().defaultNow(),
}).enableRLS();
