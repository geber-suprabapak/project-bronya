import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import { env } from "~/env";
import * as schema from "./schema";

declare global {
  var __bronyaDbConn: postgres.Sql | undefined;
}

/**
 * Cache the database connection in development to avoid creating
 * a new connection on every HMR update.
 */
const databaseUrl =
  env.DATABASE_URL || "postgresql://skanida:postgres@localhost:5432/skanida";
const conn = globalThis.__bronyaDbConn ?? postgres(databaseUrl, { max: 5 });
if (env.NODE_ENV !== "production") globalThis.__bronyaDbConn = conn;

export const db = drizzle(conn, { schema });
