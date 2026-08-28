import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

export const env = createEnv({
  /**
   * Server-side environment variables schema
   */
  server: {
    DATABASE_URL: z.string().url().optional(),
    ASTRA_API_URL: z.string().url().default("http://localhost:3000"),
    ASTRA_DEVICE_TOKEN: z.string().optional(),
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
