import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

export const env = createEnv({
  /**
   * Server-side environment variables schema
   */
  server: {
    DATABASE_URL: z.string().optional(),
    ASTRA_API_URL: z.string().url().default("http://localhost:3000"),
    ASTRA_DEVICE_TOKEN: z.string().optional(),
    LOGTO_ENDPOINT: z.string().url().optional(),
    LOGTO_APP_ID: z.string().min(1).optional(),
    LOGTO_APP_SECRET: z.string().min(1).optional(),
    LOGTO_BASE_URL: z.string().url().optional(),
    LOGTO_COOKIE_SECRET: z.string().min(32).optional(),
    LOGTO_RESOURCE: z.string().url().optional(),
    KIOSK_LATITUDE: z.coerce.number().default(-7.44998),
    KIOSK_LONGITUDE: z.coerce.number().default(110.2236),
    NODE_ENV: z
      .enum(["development", "test", "production"])
      .default("development"),
  },

  /**
   * Client-side environment variables schema
   */
  client: {
    NEXT_PUBLIC_SUPABASE_URL: z.string().optional(),
    NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().optional(),
    NEXT_PUBLIC_APP_URL: z.string().optional(),
  },

  /**
   * Runtime environment mapping
   */
  runtimeEnv: {
    DATABASE_URL: process.env.DATABASE_URL,
    ASTRA_API_URL: process.env.ASTRA_API_URL,
    ASTRA_DEVICE_TOKEN: process.env.ASTRA_DEVICE_TOKEN,
    LOGTO_ENDPOINT: process.env.LOGTO_ENDPOINT,
    LOGTO_APP_ID: process.env.LOGTO_APP_ID,
    LOGTO_APP_SECRET: process.env.LOGTO_APP_SECRET,
    LOGTO_BASE_URL: process.env.LOGTO_BASE_URL,
    LOGTO_COOKIE_SECRET: process.env.LOGTO_COOKIE_SECRET,
    LOGTO_RESOURCE: process.env.LOGTO_RESOURCE,
    KIOSK_LATITUDE: process.env.KIOSK_LATITUDE,
    KIOSK_LONGITUDE: process.env.KIOSK_LONGITUDE,
    NODE_ENV: process.env.NODE_ENV,
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
  },

  skipValidation: !!process.env.SKIP_ENV_VALIDATION,
  emptyStringAsUndefined: true,
});
