import LogtoClient from "@logto/next/edge";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import {
  extractExtendedClaims,
  isKioskOperatorRole,
  resolveLogtoRole,
} from "@/lib/logto/claims";
import { isBronyaRuntimeConfigured, logtoConfig } from "@/lib/logto/config";

const STATIC_ASSET = /^\/[^/]+\.(?:svg|png|jpg|jpeg|gif|webp|ico)$/;

const CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data:",
  "font-src 'self' data:",
  "connect-src 'self'",
  "frame-ancestors 'none'",
  "object-src 'none'",
  "base-uri 'self'",
].join("; ");

function withSecurityHeaders(response: NextResponse): NextResponse {
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  response.headers.set(
    "Permissions-Policy",
    "camera=(), microphone=(), geolocation=()",
  );
  response.headers.set("Content-Security-Policy", CONTENT_SECURITY_POLICY);
  return response;
}

function isPublicPath(pathname: string): boolean {
  return (
    pathname === "/login" ||
    pathname === "/api/health" ||
    pathname === "/api/health/live" ||
    pathname.startsWith("/api/logto/") ||
    pathname.startsWith("/_next/") ||
    pathname === "/favicon.ico" ||
    STATIC_ASSET.test(pathname)
  );
}

export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  if (process.env.NODE_ENV === "production" && !isBronyaRuntimeConfigured()) {
    if (!isPublicPath(pathname)) {
      return withSecurityHeaders(
        NextResponse.redirect(
          new URL("/login?error=session_unavailable", request.url),
        ),
      );
    }
    return withSecurityHeaders(NextResponse.next());
  }

  // Logto's edge adapter owns request cookie state. Keep the client scoped to
  // this request instead of sharing mutable state across concurrent requests.
  const logtoClient = new LogtoClient(logtoConfig);

  try {
    const context = await logtoClient.getLogtoContext(request);
    const role = resolveLogtoRole(extractExtendedClaims(context.claims)?.roles);

    if (context.isAuthenticated && isKioskOperatorRole(role)) {
      if (pathname === "/login") {
        return withSecurityHeaders(
          NextResponse.redirect(new URL("/presensi", request.url)),
        );
      }
      return withSecurityHeaders(NextResponse.next());
    }

    if (context.isAuthenticated && !isPublicPath(pathname)) {
      return withSecurityHeaders(
        NextResponse.redirect(
          new URL("/login?error=forbidden_role", request.url),
        ),
      );
    }
  } catch (error) {
    if (process.env.NODE_ENV === "development") {
      console.warn("[bronya] Logto session lookup failed", error);
    }
  }

  if (!isPublicPath(pathname)) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("redirect", pathname);
    return withSecurityHeaders(NextResponse.redirect(loginUrl));
  }

  return withSecurityHeaders(NextResponse.next());
}

export const config = {
  matcher: ["/(.*)"],
};
