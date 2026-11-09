import { products, categories, settings } from "./schema";
import type { Database } from "./client";
const rows: [string, string, number, string, string?][] = [
  ["Everyday Runner", "Sneakers", 680, "sneaker", "BESTSELLER"],
  ["Studio Wireless", "Headphones", 1250, "headphones", "NEW"],
  ["The Weekender", "Bags", 890, "bag"],
  ["Classic Chrono", "Watches", 1450, "watch", "POPULAR"],
  ["Court Low", "Sneakers", 540, "sneaker"],
  ["Sound Studio Pro", "Headphones", 1680, "headphones"],
  ["City Carryall", "Bags", 720, "bag", "NEW"],
  ["Everyday Timepiece", "Watches", 980, "watch"],
  ["Trail Runner", "Sneakers", 820, "sneaker"],
  ["Daily Audio", "Headphones", 780, "headphones"],
  ["Daily Crossbody", "Bags", 460, "bag"],
  ["Minimal Dial", "Watches", 1150, "watch"],
];
export const slugify = (name: string) =>
  name
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 100);
export const seedCategories = ["Sneakers", "Headphones", "Watches", "Bags"].map(
  (name) => ({ slug: slugify(name), name }),
);
export const seedProducts = rows.map(
  ([name, category, price, image, badge], i) => ({
    slug: slugify(name),
    name,
    category,
    priceCents: price * 100,
    rating: 48 - (i % 3),
    reviewCount: 124 + i * 17,
    stock: 18 + i,
    badge: badge ?? null,
    description: `Meet your new everyday favourite. ${name} brings considered design, lasting comfort and thoughtful details to wherever the day takes you. Made for your rhythm.`,
    images: [
      `/img/products/${image}.webp`,
      `/img/products/${image}-detail.webp`,
    ],
    colors: ["#e6dfd2", "#333b32", "#b27b57"],
    featured: i < 4,
  }),
);
// Re-running the seed is non-destructive. Use the admin reset for a deliberate reset.
export async function seedDatabase(db: Database) {
  await db.transaction(async (tx) => {
    await tx.insert(settings).values({ id: 1 }).onConflictDoNothing();
    await tx.insert(categories).values(seedCategories).onConflictDoNothing();
    await tx.insert(products).values(seedProducts).onConflictDoNothing();
  });
}
