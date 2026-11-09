import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { readStore, updateStore } from "@/lib/store";
import { products } from "@/lib/products";
export const dynamic = "force-dynamic";
async function handle(req: NextRequest) {
  const path = req.nextUrl.pathname.replace("/api/v1/", "");
  const start = Date.now();
  let state = await readStore();
  const reply = (data: unknown, status = 200) =>
    NextResponse.json(data, {
      status,
      headers: {
        "Cache-Control": "no-store",
        "X-Catalog-Version": String(state.catalogVersion),
      },
    });
  const error = (code: string, message: string, status: number) =>
    reply({ error: { code, message } }, status);
  try {
    if (
      path.startsWith("admin/") &&
      (!process.env.ADMIN_KEY ||
        req.headers.get("x-admin-key") !== process.env.ADMIN_KEY)
    )
      return error("UNAUTHORIZED", "A valid admin key is required.", 401);
    if (req.method === "GET") {
      if (path === "meta/version")
        return reply({
          catalogVersion: state.catalogVersion,
          apiVersion: "v1",
          serverTime: new Date().toISOString(),
        });
      if (path === "stats")
        return reply({
          total: state.total,
          byPath: state.byPath,
          recent: state.recent,
        });
      if (path === "orders") return reply(state.orders.slice(0, 20));
      if (
        path === "products" ||
        path === "categories" ||
        path.startsWith("products/")
      ) {
        if (state.slow) await new Promise((r) => setTimeout(r, state.slow));
        await updateStore((s) => {
          s.total++;
          s.byPath[req.nextUrl.pathname] =
            (s.byPath[req.nextUrl.pathname] ?? 0) + 1;
          s.recent.unshift({
            time: new Date().toISOString(),
            method: "GET",
            path: req.nextUrl.pathname,
            ms: Date.now() - start,
            device: /mobile|android|iphone/i.test(
              req.headers.get("user-agent") ?? "",
            )
              ? "phone"
              : "laptop",
          });
          s.recent = s.recent.slice(0, 50);
        });
        if (path === "categories")
          return reply(
            ["Sneakers", "Headphones", "Bags", "Watches"].map((name) => ({
              name,
              count: state.products.filter((p) => p.category === name).length,
            })),
          );
        if (path === "products") {
          const category = req.nextUrl.searchParams.get("category");
          return reply(
            state.products.filter((p) => !category || p.category === category),
          );
        }
        const p = state.products.find((p) => p.slug === path.slice(9));
        return p ? reply(p) : error("NOT_FOUND", "Product not found.", 404);
      }
    }
    if (req.method === "POST") {
      const body = await req.json();
      if (path === "cart") {
        const input = z
          .object({
            items: z
              .array(
                z.object({
                  slug: z.string().min(1),
                  qty: z.number().int().min(1).max(99),
                }),
              )
              .min(1)
              .max(50),
            requestId: z.string().min(1).max(100),
          })
          .parse(body);
        const order = await updateStore((s) => {
          const existing = s.orders.find((o) => o.orderRef === input.requestId);
          if (existing) return existing;
          const seen = new Set<string>();
          let total = 0;
          for (const item of input.items) {
            if (seen.has(item.slug)) throw Error("Duplicate product.");
            seen.add(item.slug);
            const p = s.products.find((p) => p.slug === item.slug);
            if (!p || p.stock < item.qty)
              throw Error("One of your products is out of stock.");
            total += p.price * item.qty;
          }
          for (const item of input.items)
            s.products.find((p) => p.slug === item.slug)!.stock -= item.qty;
          s.catalogVersion++;
          const o = {
            orderRef: input.requestId,
            receivedAt: new Date().toISOString(),
            items: input.items,
            total,
          };
          s.orders.unshift(o);
          return o;
        });
        state = await readStore();
        return reply(order, 201);
      }
      if (path === "admin/slow-mode") {
        const { ms } = z
          .object({
            ms: z.union([z.literal(0), z.literal(800), z.literal(2000)]),
          })
          .parse(body);
        await updateStore((s) => {
          s.slow = ms;
        });
        return reply({ ms });
      }
      if (path === "admin/reset") {
        await updateStore((s) => {
          s.products = structuredClone(products);
          s.catalogVersion++;
          s.total = 0;
          s.byPath = {};
          s.recent = [];
          s.orders = [];
          s.slow = 0;
        });
        state = await readStore();
        return reply({ ok: true });
      }
      if (path.startsWith("admin/products/")) {
        const input = z
          .object({
            price: z.number().positive().optional(),
            stock: z.number().int().nonnegative().optional(),
          })
          .refine((v) => v.price !== undefined || v.stock !== undefined)
          .parse(body);
        const found = await updateStore((s) => {
          const p = s.products.find((p) => p.slug === path.slice(15));
          if (!p) return false;
          Object.assign(p, input);
          s.catalogVersion++;
          return true;
        });
        state = await readStore();
        return found
          ? reply({ ok: true })
          : error("NOT_FOUND", "Product not found.", 404);
      }
    }
    return error("NOT_FOUND", "Endpoint not found.", 404);
  } catch (e) {
    return error(
      "BAD_REQUEST",
      e instanceof Error ? e.message : "Invalid request",
      400,
    );
  }
}
export { handle as GET, handle as POST };
