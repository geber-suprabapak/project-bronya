import { getLogtoContext, handleSignIn } from "@logto/next/server-actions";
import { redirect } from "next/navigation";
import type { NextRequest } from "next/server";
import {
  extractExtendedClaims,
  isKioskOperatorRole,
  resolveLogtoRole,
} from "@/lib/logto/claims";
import { logtoConfig } from "@/lib/logto/config";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const callbackUrl = new URL("/api/logto/callback", logtoConfig.baseUrl);
  callbackUrl.search = request.nextUrl.search;
  await handleSignIn(logtoConfig, callbackUrl);

  const context = await getLogtoContext(logtoConfig, { fetchUserInfo: true });
  if (!context.isAuthenticated || !context.claims) {
    redirect("/login?error=unauthorized");
  }

  const claims = extractExtendedClaims(context.claims);
  const role = resolveLogtoRole(claims?.roles);

  if (!isKioskOperatorRole(role)) {
    redirect("/login?error=forbidden_role");
  }

  redirect("/presensi");
}
