import { signIn } from "@logto/next/server-actions";
import { type NextRequest, NextResponse } from "next/server";
import { isBronyaRuntimeConfigured, logtoConfig } from "@/lib/logto/config";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  if (process.env.NODE_ENV === "production" && !isBronyaRuntimeConfigured()) {
    return NextResponse.json(
      { error: "Bronya runtime configuration is incomplete" },
      { status: 503 },
    );
  }

  const rawMode = request.nextUrl.searchParams.get("interactionMode");
  const interactionMode =
    rawMode === "signIn" || rawMode === "signUp" ? rawMode : undefined;

  await signIn(logtoConfig, {
    redirectUri: `${logtoConfig.baseUrl}/api/logto/callback`,
    interactionMode,
  });
}
