import LogtoClient from "@logto/next/edge";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import {
  extractExtendedClaims,
  isKioskOperatorRole,
  resolveLogtoRole,
} from "@/lib/logto/claims";
import { logtoConfig } from "@/lib/logto/config";

const STATIC_ASSET = /\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js|map)$/;

function isPublicPath(pathname: string): boolean {
  return (
    pathname === "/login" ||
    pathname === "/api/health" ||
    pathname.startsWith("/api/logto/") ||
    pathname.startsWith("/_next/") ||
    pathname === "/favicon.ico" ||
    STATIC_ASSET.test(pathname)
  );
}

export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  // Logto's edge adapter owns request cookie state. Keep the client scoped to
  // this request instead of sharing mutable state across concurrent requests.
  const logtoClient = new LogtoClient(logtoConfig);

  try {
    const context = await logtoClient.getLogtoContext(request);
    const role = resolveLogtoRole(extractExtendedClaims(context.claims)?.roles);

    if (context.isAuthenticated && isKioskOperatorRole(role)) {
      if (pathname === "/login") {
        return NextResponse.redirect(new URL("/presensi", request.url));
      }
      return NextResponse.next();
    }

    if (context.isAuthenticated && !isPublicPath(pathname)) {
      return NextResponse.redirect(
        new URL("/login?error=forbidden_role", request.url),
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
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/(.*)"],
};
