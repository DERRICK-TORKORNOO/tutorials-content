import { Hono } from "hono";
import { bodyLimit } from "hono/body-limit";
import { timingSafeEqual, randomUUID } from "node:crypto";
import sharp from "sharp";
import { z } from "zod";
import { getDatabase } from "./db/client";
import { createRepository, type Repository } from "./db/repository";
import { createStorage, type ImageStorage } from "./storage";
import { AppError } from "./errors";
import {
  productInput,
  patchProduct,
  slugParam,
  imageKey,
  cartInput,
  categoryInput,
  slowInput,
} from "./validation";
type Variables = { repo: Repository; version: number };
const validKey = (provided: string) => {
  const expected = process.env.ADMIN_KEY ?? "";
  const a = Buffer.from(provided),
    b = Buffer.from(expected);
  return !!expected && a.length === b.length && timingSafeEqual(a, b);
};
export function createApp(
  repository = () => createRepository(getDatabase()),
  storage: () => ImageStorage = createStorage,
) {
  const app = new Hono<{ Variables: Variables }>().basePath("/api/v1");
  app.onError((error, c) => {
    if (error instanceof AppError)
      return c.json(
        {
          error: {
            code: error.code,
            message: error.message,
            fields: error.fields,
          },
        },
        error.status,
      );
    if (error instanceof z.ZodError) {
      const fields: Record<string, string> = {};
      error.issues.forEach((issue) => {
        const field = String(issue.path[0] ?? "form");
        fields[field] ??= issue.message;
      });
      return c.json(
        {
          error: {
            code: "VALIDATION_ERROR",
            message: "Please check the highlighted fields.",
            fields,
          },
        },
        400,
      );
    }
    if (error instanceof SyntaxError)
      return c.json(
        { error: { code: "INVALID_JSON", message: "Send valid JSON." } },
        400,
      );
    const code =
      (error as { code?: string; cause?: { code?: string } }).code ??
      (error as { cause?: { code?: string } }).cause?.code;
    if (code === "23505")
      return c.json(
        {
          error: {
            code: "CONFLICT",
            message: "This name or identifier already exists.",
          },
        },
        409,
      );
    if (error.message === "DATABASE_NOT_CONFIGURED" || code === "42P01")
      return c.json(
        {
          error: {
            code: "SETUP_REQUIRED",
            message:
              "The shop database is not configured yet. Follow the Supabase setup guide in the README.",
          },
        },
        503,
      );
    return c.json(
      {
        error: {
          code: "SERVER_ERROR",
          message: "The server could not complete this request. Please retry.",
        },
      },
      500,
    );
  });
  app.use("*", async (c, next) => {
    c.header("Cache-Control", "no-store");
    c.header("X-Catalog-Version", "0");
    const path = new URL(c.req.url).pathname;
    if (
      path.includes("/admin/") &&
      !validKey(c.req.header("x-admin-key") ?? "")
    )
      throw new AppError("UNAUTHORIZED", "Enter a valid admin key.", 401);
    if (path === "/api/v1/admin/session") {
      await next();
      return;
    }
    const repo = repository();
    c.set("repo", repo);
    const state = await repo.getSettings();
    c.set("version", state.catalogVersion);
    c.header("X-Catalog-Version", String(state.catalogVersion));
    const catalog =
      /^\/api\/v1\/(products(?:\/[^/]+)?|categories)$/.test(path) &&
      c.req.method === "GET";
    const start = Date.now();
    if (catalog && state.slowMode)
      await new Promise((resolve) => setTimeout(resolve, state.slowMode));
    await next();
    if (catalog)
      await repo.log({
        method: c.req.method,
        path,
        ms: Date.now() - start,
        device: /mobile|android|iphone/i.test(c.req.header("user-agent") ?? "")
          ? "phone"
          : "laptop",
      });
  });
  app.get("/admin/session", (c) => c.json({ ok: true }));
  app.get("/meta/version", (c) =>
    c.json({
      catalogVersion: c.get("version"),
      apiVersion: "v1",
      serverTime: new Date().toISOString(),
    }),
  );
  app.get("/products", async (c) => {
    const category = c.req.query("category");
    if (category) z.string().min(1).max(80).parse(category);
    return c.json(
      (await c.get("repo").listProducts(false, category)).map(
        ({ description, colors, ...summary }) => {
          void description;
          void colors;
          return summary;
        },
      ),
    );
  });
  app.get("/products/:slug", async (c) =>
    c.json(await c.get("repo").product(slugParam.parse(c.req.param("slug")))),
  );
  app.get("/categories", async (c) =>
    c.json(await c.get("repo").listCategories()),
  );
  app.get("/stats", async (c) => c.json(await c.get("repo").stats()));
  app.get("/orders", async (c) => c.json(await c.get("repo").listOrders()));
  app.post("/cart", async (c) => {
    const input = cartInput.parse(await c.req.json());
    const result = await c.get("repo").checkout(input);
    c.header("X-Catalog-Version", String(result.catalogVersion));
    return c.json(result.value, 201);
  });
  app.get("/admin/overview", async (c) => {
    const repo = c.get("repo");
    const [stats, orders] = await Promise.all([
      repo.stats(),
      repo.listOrders(),
    ]);
    return c.json({
      stats,
      orders: orders.slice(0, 5),
      catalogVersion: c.get("version"),
    });
  });
  app.get("/admin/products", async (c) =>
    c.json(await c.get("repo").listProducts(true)),
  );
  app.get("/admin/categories", async (c) =>
    c.json(await c.get("repo").listCategories()),
  );
  app.get("/admin/orders", async (c) =>
    c.json(await c.get("repo").listOrders()),
  );
  app.get("/admin/settings", async (c) => {
    const repo = c.get("repo");
    return c.json({
      ...(await repo.getSettings()),
      cleanupPending: (await repo.pendingImages()).length,
    });
  });
  app.post("/admin/products", async (c) => {
    const result = await c
      .get("repo")
      .createProduct(productInput.parse(await c.req.json()));
    c.header("X-Catalog-Version", String(result.catalogVersion));
    return c.json(
      { product: result.value, catalogVersion: result.catalogVersion },
      201,
    );
  });
  app.patch("/admin/products/:slug", async (c) => {
    const result = await c
      .get("repo")
      .editProduct(
        slugParam.parse(c.req.param("slug")),
        patchProduct.parse(await c.req.json()),
      );
    c.header("X-Catalog-Version", String(result.catalogVersion));
    return c.json({
      product: result.value,
      catalogVersion: result.catalogVersion,
    });
  });
  app.delete("/admin/products/:slug", async (c) => {
    const result = await c
      .get("repo")
      .archiveProduct(slugParam.parse(c.req.param("slug")));
    c.header("X-Catalog-Version", String(result.catalogVersion));
    return c.json({
      product: result.value,
      catalogVersion: result.catalogVersion,
    });
  });
  app.post("/admin/products/:slug/restore", async (c) => {
    const result = await c
      .get("repo")
      .archiveProduct(slugParam.parse(c.req.param("slug")), true);
    c.header("X-Catalog-Version", String(result.catalogVersion));
    return c.json({
      product: result.value,
      catalogVersion: result.catalogVersion,
    });
  });
  app.post("/admin/categories", async (c) => {
    const { name } = categoryInput.parse(await c.req.json());
    const result = await c.get("repo").createCategory(name);
    c.header("X-Catalog-Version", String(result.catalogVersion));
    return c.json(
      { category: result.value, catalogVersion: result.catalogVersion },
      201,
    );
  });
  app.post("/admin/slow-mode", async (c) => {
    const { ms } = slowInput.parse(await c.req.json());
    await c.get("repo").setSlowMode(ms);
    return c.json({ ms });
  });
  app.post("/admin/stats/clear", async (c) => {
    await c.get("repo").clearStats();
    return c.json({ ok: true });
  });
  async function cleanup(repo: Repository) {
    const keys = (await repo.pendingImages()).map((i) => i.key);
    if (!keys.length) return;
    const gateway = storage();
    for (let i = 0; i < keys.length; i += 100) {
      const batch = keys.slice(i, i + 100);
      await gateway.remove(batch);
      await repo.removedImages(batch);
    }
  }
  app.post("/admin/images/cleanup", async (c) => {
    await cleanup(c.get("repo"));
    return c.json({ ok: true });
  });
  app.post("/admin/reset", async (c) => {
    const repo = c.get("repo");
    const result = await repo.reset();
    c.header("X-Catalog-Version", String(result.catalogVersion));
    try {
      await cleanup(repo);
      return c.json({
        ok: true,
        catalogVersion: result.catalogVersion,
        cleanupPending: false,
      });
    } catch {
      return c.json(
        {
          ok: true,
          catalogVersion: result.catalogVersion,
          cleanupPending: true,
          message:
            "Catalog reset. Image cleanup is pending; retry it in Settings.",
        },
        202,
      );
    }
  });
  app.post(
    "/admin/images",
    bodyLimit({
      maxSize: 5 * 1024 * 1024 + 65536,
      onError: (c) =>
        c.json(
          {
            error: {
              code: "TOO_LARGE",
              message: "Choose an image under 5 MB.",
            },
          },
          413,
        ),
    }),
    async (c) => {
      const data = await c.req.formData();
      const file = data.get("file");
      if (!(file instanceof File))
        throw new AppError("INVALID_IMAGE", "Choose an image file.");
      if (file.size > 5 * 1024 * 1024)
        throw new AppError("TOO_LARGE", "Choose an image under 5 MB.", 413);
      if (!["image/jpeg", "image/png", "image/webp"].includes(file.type))
        throw new AppError(
          "INVALID_IMAGE",
          "Use a JPEG, PNG or WebP image.",
          415,
        );
      let bytes: Buffer;
      try {
        const image = sharp(Buffer.from(await file.arrayBuffer()), {
          limitInputPixels: 32000000,
        });
        const info = await image.metadata();
        if (!["jpeg", "png", "webp"].includes(info.format ?? "")) throw Error();
        bytes = await image
          .rotate()
          .resize({ width: 1200, withoutEnlargement: true })
          .webp({ quality: 80 })
          .toBuffer();
      } catch {
        throw new AppError(
          "INVALID_IMAGE",
          "This image could not be read. Try another JPEG, PNG or WebP.",
          415,
        );
      }
      const key = `${randomUUID()}.webp`;
      const gateway = storage();
      await gateway.upload(key, bytes);
      try {
        await c.get("repo").registerImage(key);
      } catch (error) {
        await gateway.remove([key]).catch(() => {});
        throw error;
      }
      return c.json({ url: `/api/v1/images/${key}` }, 201);
    },
  );
  app.get("/images/:key", async (c) => {
    const key = imageKey.parse(c.req.param("key"));
    if (!(await c.get("repo").imageExists(key)))
      throw new AppError("NOT_FOUND", "Image not found.", 404);
    const response = await storage().download(key);
    c.header("Cache-Control", "public, max-age=31536000, immutable");
    c.header("Content-Type", "image/webp");
    c.header("X-Content-Type-Options", "nosniff");
    if (!response.body)
      throw new AppError(
        "STORAGE_UNAVAILABLE",
        "Image storage returned an empty response.",
        503,
      );
    return c.body(response.body);
  });
  app.notFound((c) =>
    c.json(
      { error: { code: "NOT_FOUND", message: "Endpoint not found." } },
      404,
    ),
  );
  return app;
}
export const app = createApp();
