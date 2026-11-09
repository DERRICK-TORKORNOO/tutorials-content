-- Kudi Store: paste ONCE into a new Supabase project SQL Editor.
-- Creates tables with RLS enabled and no public policies, seed data and a PRIVATE image bucket.
BEGIN;

CREATE SCHEMA IF NOT EXISTS drizzle;

CREATE TABLE IF NOT EXISTS drizzle.__drizzle_migrations (id SERIAL PRIMARY KEY, hash text NOT NULL, created_at bigint);

CREATE TABLE "categories" (
	"slug" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "categories_name_unique" UNIQUE("name")
);

ALTER TABLE "categories" ENABLE ROW LEVEL SECURITY;
CREATE TABLE "orders" (
	"order_ref" text PRIMARY KEY NOT NULL,
	"request_id" text NOT NULL,
	"fingerprint" text NOT NULL,
	"items" jsonb NOT NULL,
	"total_cents" integer NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"received_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "orders_request_id_unique" UNIQUE("request_id")
);

ALTER TABLE "orders" ENABLE ROW LEVEL SECURITY;
CREATE TABLE "products" (
	"slug" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"category" text NOT NULL,
	"price_cents" integer NOT NULL,
	"currency" text DEFAULT 'GHS' NOT NULL,
	"rating_tenths" integer DEFAULT 48 NOT NULL,
	"review_count" integer DEFAULT 0 NOT NULL,
	"stock" integer NOT NULL,
	"badge" text,
	"description" text NOT NULL,
	"images" jsonb NOT NULL,
	"colors" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"featured" boolean DEFAULT false NOT NULL,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "positive_price" CHECK ("products"."price_cents">0),
	CONSTRAINT "nonnegative_stock" CHECK ("products"."stock">=0)
);

ALTER TABLE "products" ENABLE ROW LEVEL SECURITY;
CREATE TABLE "request_log" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"time" timestamp with time zone DEFAULT now() NOT NULL,
	"method" text NOT NULL,
	"path" text NOT NULL,
	"ms" integer NOT NULL,
	"device" text NOT NULL
);

ALTER TABLE "request_log" ENABLE ROW LEVEL SECURITY;
CREATE TABLE "settings" (
	"id" integer PRIMARY KEY DEFAULT 1 NOT NULL,
	"catalog_version" integer DEFAULT 1 NOT NULL,
	"slow_mode" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "singleton_settings" CHECK ("settings"."id"=1)
);

ALTER TABLE "settings" ENABLE ROW LEVEL SECURITY;
CREATE TABLE "uploaded_images" (
	"key" text PRIMARY KEY NOT NULL,
	"cleanup_pending" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE "uploaded_images" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "products" ADD CONSTRAINT "products_category_categories_name_fk" FOREIGN KEY ("category") REFERENCES "public"."categories"("name") ON DELETE no action ON UPDATE no action;
CREATE INDEX "orders_received_idx" ON "orders" USING btree ("received_at");
CREATE INDEX "product_category_idx" ON "products" USING btree ("category");
CREATE INDEX "request_time_idx" ON "request_log" USING btree ("time");

INSERT INTO drizzle.__drizzle_migrations(hash, created_at) VALUES ('88728bdde065cbffff84dfdb1cb2e47048ed80df3c3c2abe1fd73b1781c65811', 1794219452444);

ALTER TABLE "orders" ALTER COLUMN "total_cents" SET DATA TYPE bigint;

INSERT INTO drizzle.__drizzle_migrations(hash, created_at) VALUES ('531bf038bbbff97fc7babf926bebe4bff8005b0c7d72f56a140e68904b133cba', 1794220317606);

INSERT INTO settings(id,catalog_version,slow_mode) VALUES (1,1,0) ON CONFLICT(id) DO NOTHING;

INSERT INTO categories(slug,name) VALUES ('sneakers','Sneakers'),
('headphones','Headphones'),
('watches','Watches'),
('bags','Bags') ON CONFLICT DO NOTHING;

INSERT INTO products(slug,name,category,price_cents,rating_tenths,review_count,stock,badge,description,images,colors,featured) VALUES ('everyday-runner','Everyday Runner','Sneakers',68000,48,124,18,'BESTSELLER','Meet your new everyday favourite. Everyday Runner brings considered design, lasting comfort and thoughtful details to wherever the day takes you. Made for your rhythm.','["/img/products/sneaker.webp","/img/products/sneaker-detail.webp"]','["#e6dfd2","#333b32","#b27b57"]',true),
('studio-wireless','Studio Wireless','Headphones',125000,47,141,19,'NEW','Meet your new everyday favourite. Studio Wireless brings considered design, lasting comfort and thoughtful details to wherever the day takes you. Made for your rhythm.','["/img/products/headphones.webp","/img/products/headphones-detail.webp"]','["#e6dfd2","#333b32","#b27b57"]',true),
('the-weekender','The Weekender','Bags',89000,46,158,20,NULL,'Meet your new everyday favourite. The Weekender brings considered design, lasting comfort and thoughtful details to wherever the day takes you. Made for your rhythm.','["/img/products/bag.webp","/img/products/bag-detail.webp"]','["#e6dfd2","#333b32","#b27b57"]',true),
('classic-chrono','Classic Chrono','Watches',145000,48,175,21,'POPULAR','Meet your new everyday favourite. Classic Chrono brings considered design, lasting comfort and thoughtful details to wherever the day takes you. Made for your rhythm.','["/img/products/watch.webp","/img/products/watch-detail.webp"]','["#e6dfd2","#333b32","#b27b57"]',true),
('court-low','Court Low','Sneakers',54000,47,192,22,NULL,'Meet your new everyday favourite. Court Low brings considered design, lasting comfort and thoughtful details to wherever the day takes you. Made for your rhythm.','["/img/products/sneaker.webp","/img/products/sneaker-detail.webp"]','["#e6dfd2","#333b32","#b27b57"]',false),
('sound-studio-pro','Sound Studio Pro','Headphones',168000,46,209,23,NULL,'Meet your new everyday favourite. Sound Studio Pro brings considered design, lasting comfort and thoughtful details to wherever the day takes you. Made for your rhythm.','["/img/products/headphones.webp","/img/products/headphones-detail.webp"]','["#e6dfd2","#333b32","#b27b57"]',false),
('city-carryall','City Carryall','Bags',72000,48,226,24,'NEW','Meet your new everyday favourite. City Carryall brings considered design, lasting comfort and thoughtful details to wherever the day takes you. Made for your rhythm.','["/img/products/bag.webp","/img/products/bag-detail.webp"]','["#e6dfd2","#333b32","#b27b57"]',false),
('everyday-timepiece','Everyday Timepiece','Watches',98000,47,243,25,NULL,'Meet your new everyday favourite. Everyday Timepiece brings considered design, lasting comfort and thoughtful details to wherever the day takes you. Made for your rhythm.','["/img/products/watch.webp","/img/products/watch-detail.webp"]','["#e6dfd2","#333b32","#b27b57"]',false),
('trail-runner','Trail Runner','Sneakers',82000,46,260,26,NULL,'Meet your new everyday favourite. Trail Runner brings considered design, lasting comfort and thoughtful details to wherever the day takes you. Made for your rhythm.','["/img/products/sneaker.webp","/img/products/sneaker-detail.webp"]','["#e6dfd2","#333b32","#b27b57"]',false),
('daily-audio','Daily Audio','Headphones',78000,48,277,27,NULL,'Meet your new everyday favourite. Daily Audio brings considered design, lasting comfort and thoughtful details to wherever the day takes you. Made for your rhythm.','["/img/products/headphones.webp","/img/products/headphones-detail.webp"]','["#e6dfd2","#333b32","#b27b57"]',false),
('daily-crossbody','Daily Crossbody','Bags',46000,47,294,28,NULL,'Meet your new everyday favourite. Daily Crossbody brings considered design, lasting comfort and thoughtful details to wherever the day takes you. Made for your rhythm.','["/img/products/bag.webp","/img/products/bag-detail.webp"]','["#e6dfd2","#333b32","#b27b57"]',false),
('minimal-dial','Minimal Dial','Watches',115000,46,311,29,NULL,'Meet your new everyday favourite. Minimal Dial brings considered design, lasting comfort and thoughtful details to wherever the day takes you. Made for your rhythm.','["/img/products/watch.webp","/img/products/watch-detail.webp"]','["#e6dfd2","#333b32","#b27b57"]',false) ON CONFLICT DO NOTHING;

INSERT INTO storage.buckets (id,name,public,file_size_limit,allowed_mime_types) VALUES ('product-images','product-images',false,5242880,ARRAY['image/webp']) ON CONFLICT(id) DO UPDATE SET public=false, file_size_limit=5242880, allowed_mime_types=ARRAY['image/webp'];

COMMIT;
