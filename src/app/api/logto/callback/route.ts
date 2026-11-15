import { getLogtoContext, handleSignIn } from "@logto/next/server-actions";
import { isRedirectError } from "next/dist/client/components/redirect-error";
import { redirect } from "next/navigation";
import { type NextRequest, NextResponse } from "next/server";
import {
  extractExtendedClaims,
  isKioskOperatorRole,
  resolveLogtoRole,
} from "@/lib/logto/claims";
import { isBronyaRuntimeConfigured, logtoConfig } from "@/lib/logto/config";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  if (process.env.NODE_ENV === "production" && !isBronyaRuntimeConfigured()) {
    return NextResponse.json(
      { error: "Bronya runtime configuration is incomplete" },
      { status: 503 },
    );
  }

  let destination = "/presensi";
  try {
    const callbackUrl = new URL("/api/logto/callback", logtoConfig.baseUrl);
    callbackUrl.search = request.nextUrl.search;
    await handleSignIn(logtoConfig, callbackUrl);

    const context = await getLogtoContext(logtoConfig, { fetchUserInfo: true });
    if (!context.isAuthenticated || !context.claims) {
      destination = "/login?error=unauthorized";
    } else {
      const claims = extractExtendedClaims(context.claims);
      const role = resolveLogtoRole(claims?.roles);
      if (!isKioskOperatorRole(role)) {
        destination = "/login?error=forbidden_role";
      }
    }
  } catch (error) {
    if (isRedirectError(error)) {
      throw error;
    }
    destination = "/login?error=unauthorized";
  }

  redirect(destination);
}
