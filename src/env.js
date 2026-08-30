import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

export const env = createEnv({
  /**
   * Server-side environment variables schema
   */
  server: {
    DATABASE_URL: z.string().optional(),
    ASTRA_API_URL: z.string().url().default("http://localhost:23000"),
    LOGTO_ENDPOINT: z.string().url().optional(),
    LOGTO_APP_ID: z.string().min(1).optional(),
    LOGTO_APP_SECRET: z.string().min(1).optional(),
    LOGTO_BASE_URL: z.string().url().optional(),
    LOGTO_COOKIE_SECRET: z.string().min(32).optional(),
    LOGTO_RESOURCE: z.string().url().optional(),
    LOGTO_POST_LOGOUT_REDIRECT_URI: z.string().url().optional(),
    KIOSK_LATITUDE: z.coerce.number().default(-7.44998),
    KIOSK_LONGITUDE: z.coerce.number().default(110.2236),
    NODE_ENV: z
      .enum(["development", "test", "production"])
      .default("development"),
  },

  // Logto and Astra credentials are server-only and must never be exposed to
  // the browser.
  client: {},

  /**
   * Runtime environment mapping
   */
  runtimeEnv: {
    DATABASE_URL: process.env.DATABASE_URL,
    ASTRA_API_URL: process.env.ASTRA_API_URL,
    LOGTO_ENDPOINT: process.env.LOGTO_ENDPOINT,
    LOGTO_APP_ID: process.env.LOGTO_APP_ID,
    LOGTO_APP_SECRET: process.env.LOGTO_APP_SECRET,
    LOGTO_BASE_URL: process.env.LOGTO_BASE_URL,
    LOGTO_COOKIE_SECRET: process.env.LOGTO_COOKIE_SECRET,
    LOGTO_RESOURCE: process.env.LOGTO_RESOURCE,
    LOGTO_POST_LOGOUT_REDIRECT_URI: process.env.LOGTO_POST_LOGOUT_REDIRECT_URI,
    KIOSK_LATITUDE: process.env.KIOSK_LATITUDE,
    KIOSK_LONGITUDE: process.env.KIOSK_LONGITUDE,
    NODE_ENV: process.env.NODE_ENV,
  },

  skipValidation: !!process.env.SKIP_ENV_VALIDATION,
  emptyStringAsUndefined: true,
});

/**
 * Optional schemas keep local static builds usable without external services.
 * A production process must provide the complete Logto/Astra boundary and
 * fails at boot with the missing variable names if it does not.
 */
export const PRODUCTION_REQUIRED_ENV = [
  "ASTRA_API_URL",
  "LOGTO_ENDPOINT",
  "LOGTO_APP_ID",
  "LOGTO_APP_SECRET",
  "LOGTO_BASE_URL",
  "LOGTO_COOKIE_SECRET",
  "LOGTO_RESOURCE",
  "LOGTO_POST_LOGOUT_REDIRECT_URI",
];

export function getMissingProductionEnv(input = process.env) {
  return PRODUCTION_REQUIRED_ENV.filter((name) => !input[name]?.trim());
}

// Next evaluates server modules while producing the build. Defer the strict
// production boot check until the deployed process starts; the readiness
// endpoint still reports the same missing values during development/builds.
const isNextProductionBuild =
  process.env.NEXT_PHASE === "phase-production-build";

if (
  env.NODE_ENV === "production" &&
  !process.env.SKIP_ENV_VALIDATION &&
  !isNextProductionBuild
) {
  const missing = getMissingProductionEnv();
  if (missing.length > 0) {
    throw new Error(
      `[env] Missing required production configuration: ${missing.join(", ")}`,
    );
  }
}
