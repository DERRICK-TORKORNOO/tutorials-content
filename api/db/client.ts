import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import * as schema from "./schema";
// Only the connection pool is reused; all application state lives in Postgres.
let connection: ReturnType<typeof postgres> | undefined;
export function getDatabase() {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_NOT_CONFIGURED");
  connection ??= postgres(process.env.DATABASE_URL, {
    prepare: false,
    ssl: "require",
    max: 3,
    idle_timeout: 20,
    connect_timeout: 10,
  });
  return drizzle(connection, { schema });
}
export async function closeDatabase() {
  await connection?.end();
  connection = undefined;
}
export type Database = ReturnType<typeof getDatabase>;
