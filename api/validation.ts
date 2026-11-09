import { z } from "zod";
const image = z
  .string()
  .regex(
    /^\/(img\/products\/[a-z0-9-]+\.webp|api\/v1\/images\/[a-f0-9-]{36}\.webp)$/,
    "Use an uploaded image or a local product image.",
  );
export const productInput = z.object({
  name: z.string().trim().min(2, "Enter at least 2 characters.").max(120),
  category: z.string().trim().min(1, "Choose a category.").max(80),
  price: z
    .number()
    .positive("Enter a price greater than zero.")
    .max(1000000)
    .refine(
      (n) => Math.abs(n * 100 - Math.round(n * 100)) < 0.00001,
      "Use at most 2 decimal places.",
    ),
  stock: z.number().int().min(0).max(1000000),
  description: z
    .string()
    .trim()
    .min(10, "Add at least 10 characters.")
    .max(3000),
  badge: z.string().trim().max(30).default(""),
  colors: z
    .array(z.string().regex(/^#[0-9a-fA-F]{6}$/, "Use six-digit hex colours."))
    .max(8)
    .default([]),
  images: z.array(image).min(1, "Add at least one image.").max(4),
  featured: z.boolean().default(false),
});
// Patch fields must not carry create-time defaults: a price edit must not clear badges/colours/featured.
export const patchProduct = productInput
  .extend({
    badge: z.string().trim().max(30),
    colors: z.array(z.string().regex(/^#[0-9a-fA-F]{6}$/)).max(8),
    featured: z.boolean(),
  })
  .partial()
  .refine(
    (value) => Object.keys(value).length > 0,
    "Choose a field to update.",
  );
export type ProductInput = z.infer<typeof productInput>;
export const slugParam = z
  .string()
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
  .max(140);
export const imageKey = z.string().regex(/^[a-f0-9-]{36}\.webp$/);
export const cartInput = z
  .object({
    items: z
      .array(
        z.object({ slug: slugParam, qty: z.number().int().min(1).max(99) }),
      )
      .min(1)
      .max(50),
    requestId: z.string().min(1).max(100).optional(),
    createdAt: z.iso.datetime().optional(),
  })
  .refine(
    (v) => new Set(v.items.map((i) => i.slug)).size === v.items.length,
    "Duplicate cart items are not allowed.",
  );
export const categoryInput = z.object({
  name: z.string().trim().min(2).max(80),
});
export const slowInput = z.object({
  ms: z.union([z.literal(0), z.literal(800), z.literal(2000)]),
});
