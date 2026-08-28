import type { Config } from "drizzle-kit";

import { env } from "~/env";

export default {
  schema: "./src/server/db/schema.ts",
  dialect: "postgresql",
  dbCredentials: {
    url:
      env.DATABASE_URL ||
      "postgresql://skanida:postgres@localhost:5432/skanida",
  },
} satisfies Config;
