// Browser QA only: real repository/API against PostgreSQL WASM, with a fake Storage transport.
// This is not imported by the application and is never an application fallback.
import { createServer } from "node:http";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { createRepository } from "../api/db/repository";
import { seedDatabase } from "../api/db/seed";
import { createApp } from "../api/app";
import type { Database } from "../api/db/client";
import * as schema from "../api/db/schema";
async function main() {
  const pg = new PGlite();
  const db = drizzle(pg, { schema });
  await migrate(db, { migrationsFolder: "api/db/migrations" });
  await seedDatabase(db as unknown as Database);
  const objects = new Map<string, Uint8Array>();
  process.env.ADMIN_KEY = "kudi-preview";
  const app = createApp(
    () => createRepository(db as unknown as Database),
    () => ({
      upload: async (key, bytes) => {
        objects.set(key, bytes);
      },
      download: async (key) => new Response(new Uint8Array(objects.get(key)!)),
      remove: async (keys) => {
        keys.forEach((key) => objects.delete(key));
      },
    }),
  );
  await app.request("/api/v1/products", {
    headers: { "user-agent": "phone iPhone" },
  });
  await app.request("/api/v1/categories", {
    headers: { "user-agent": "phone iPhone" },
  });
  await app.request("/api/v1/cart", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      items: [{ slug: "everyday-runner", qty: 1 }],
      requestId: "preview-order",
      createdAt: new Date(Date.now() - 30000).toISOString(),
    }),
  });
  const server = createServer(async (req, res) => {
    try {
      const url = req.url ?? "/";
      const headers = new Headers();
      Object.entries(req.headers).forEach(([name, value]) => {
        if (value)
          headers.set(name, Array.isArray(value) ? value.join(",") : value);
      });
      let response: Response;
      if (url.startsWith("/api/")) {
        const chunks: Buffer[] = [];
        for await (const chunk of req) chunks.push(Buffer.from(chunk));
        response = await app.fetch(
          new Request(`http://localhost:3001${url}`, {
            method: req.method,
            headers,
            ...(chunks.length ? { body: Buffer.concat(chunks) } : {}),
          }),
        );
      } else
        response = await fetch(`http://127.0.0.1:3000${url}`, {
          headers,
          redirect: "manual",
        });
      res.statusCode = response.status;
      response.headers.forEach((value, name) => {
        if (
          !["content-encoding", "content-length", "transfer-encoding"].includes(
            name,
          )
        )
          res.setHeader(name, value);
      });
      res.end(Buffer.from(await response.arrayBuffer()));
    } catch {
      res.writeHead(502);
      res.end("Start the Next.js production preview on port 3000 first.");
    }
  });
  server.listen(3001, "127.0.0.1", () =>
    console.log(
      "Test-only preview: http://localhost:3001/admin — admin key: kudi-preview",
    ),
  );
  process.on("SIGINT", () => {
    server.close();
    void pg.close().then(() => process.exit(0));
  });
}
main().catch(() => {
  console.error("Test preview failed.");
  process.exitCode = 1;
});
