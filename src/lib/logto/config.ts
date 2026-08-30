import { type LogtoNextConfig, UserScope } from "@logto/next";
import { env } from "@/env";

export function isBronyaRuntimeConfigured(): boolean {
  return Boolean(
    env.LOGTO_ENDPOINT &&
      env.LOGTO_APP_ID &&
      env.LOGTO_APP_SECRET &&
      env.LOGTO_BASE_URL &&
      env.LOGTO_COOKIE_SECRET &&
      env.LOGTO_RESOURCE &&
      env.ASTRA_API_URL &&
      env.ASTRA_DEVICE_TOKEN,
  );
}

// These development placeholders keep static build evaluation deterministic.
// Production readiness is enforced by /api/health before Portainer can mark the
// kiosk healthy, so an unset runtime secret never becomes a working fallback.
export const logtoConfig: LogtoNextConfig = {
  endpoint: env.LOGTO_ENDPOINT ?? "http://localhost:3001",
  appId: env.LOGTO_APP_ID ?? "bronya-dev-app",
  appSecret:
    env.LOGTO_APP_SECRET ?? "bronya-dev-secret-not-for-production-only",
  baseUrl: env.LOGTO_BASE_URL ?? "http://localhost:3000",
  cookieSecret:
    env.LOGTO_COOKIE_SECRET ??
    "bronya-dev-cookie-secret-not-for-production-only",
  cookieSecure: env.NODE_ENV === "production",
  scopes: [
    UserScope.Profile,
    UserScope.Email,
    UserScope.Roles,
    "mobile:access",
    "admin:read",
    "files:read:any",
    "files:delete:any",
  ],
  resources: env.LOGTO_RESOURCE ? [env.LOGTO_RESOURCE] : undefined,
};
