import { loadEnvConfig } from "@next/env";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { getDatabase, closeDatabase } from "../api/db/client";
import { seedDatabase } from "../api/db/seed";
loadEnvConfig(process.cwd());
async function run() {
  try {
    const db = getDatabase();
    if (process.argv[2] === "seed") await seedDatabase(db);
    else await migrate(db, { migrationsFolder: "./api/db/migrations" });
    console.log(
      "Database " + (process.argv[2] === "seed" ? "seeded." : "migrated."),
    );
  } finally {
    await closeDatabase();
  }
}
run().catch(() => {
  console.error(
    "Database setup failed. Check DATABASE_URL, your pooler credentials, and migration permissions.",
  );
  process.exitCode = 1;
});
