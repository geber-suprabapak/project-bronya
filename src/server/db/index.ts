import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import { env } from "~/env";
import * as schema from "./schema";

/**
 * Cache the database connection in development to avoid creating
 * a new connection on every HMR update.
 */
const globalForDb = globalThis as unknown as {
  conn: postgres.Sql | undefined;
};

const databaseUrl =
  env.DATABASE_URL || "postgresql://skanida:postgres@localhost:5432/skanida";
const conn = globalForDb.conn ?? postgres(databaseUrl, { max: 5 });
if (env.NODE_ENV !== "production") globalForDb.conn = conn;

export const db = drizzle(conn, { schema });
