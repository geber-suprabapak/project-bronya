import { type LogtoNextConfig, UserScope } from "@logto/next";
import { env } from "../../env.js";

const REQUIRED_RUNTIME_VALUES = {
  ASTRA_API_URL: env.ASTRA_API_URL,
  LOGTO_ENDPOINT: env.LOGTO_ENDPOINT,
  LOGTO_APP_ID: env.LOGTO_APP_ID,
  LOGTO_APP_SECRET: env.LOGTO_APP_SECRET,
  LOGTO_BASE_URL: env.LOGTO_BASE_URL,
  LOGTO_COOKIE_SECRET: env.LOGTO_COOKIE_SECRET,
  LOGTO_RESOURCE: env.LOGTO_RESOURCE,
  LOGTO_POST_LOGOUT_REDIRECT_URI: env.LOGTO_POST_LOGOUT_REDIRECT_URI,
};

export function getMissingBronyaRuntimeVariables(): string[] {
  return Object.entries(REQUIRED_RUNTIME_VALUES)
    .filter(([, value]) => !value)
    .map(([name]) => name);
}

export function isBronyaRuntimeConfigured(): boolean {
  return getMissingBronyaRuntimeVariables().length === 0;
}

export const BRONYA_LOGTO_SCOPES = [
  UserScope.Profile,
  UserScope.Email,
  UserScope.Roles,
  "mobile:access",
  "admin:read",
  "files:read:any",
  "files:delete:any",
] as const;

// These development placeholders keep static build evaluation deterministic.
// Production boot validation and /api/health still require real values.
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
  scopes: [...BRONYA_LOGTO_SCOPES],
  resources: env.LOGTO_RESOURCE ? [env.LOGTO_RESOURCE] : undefined,
};
