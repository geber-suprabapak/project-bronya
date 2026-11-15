import { getLogtoContext } from "@logto/next/server-actions";
import { NextResponse } from "next/server";
import {
  extractExtendedClaims,
  isKioskOperatorRole,
  resolveLogtoRole,
} from "@/lib/logto/claims";
import { isBronyaRuntimeConfigured, logtoConfig } from "@/lib/logto/config";

export const dynamic = "force-dynamic";

export async function GET() {
  if (process.env.NODE_ENV === "production" && !isBronyaRuntimeConfigured()) {
    return NextResponse.json(
      { isAuthenticated: false, user: null },
      { status: 503 },
    );
  }

  try {
    const context = await getLogtoContext(logtoConfig, {
      fetchUserInfo: true,
    });
    const claims = extractExtendedClaims(context.claims);
    const role = resolveLogtoRole(claims?.roles);

    return NextResponse.json({
      isAuthenticated: context.isAuthenticated,
      user: context.isAuthenticated
        ? {
            id: claims?.sub ?? null,
            email: claims?.email ?? context.userInfo?.email ?? null,
            name: context.userInfo?.name ?? claims?.name ?? null,
            role,
            isKioskOperator: isKioskOperatorRole(role),
          }
        : null,
    });
  } catch {
    return NextResponse.json(
      { isAuthenticated: false, user: null },
      { status: 401 },
    );
  }
}
