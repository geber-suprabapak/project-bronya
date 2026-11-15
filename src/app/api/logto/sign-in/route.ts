import { signIn } from "@logto/next/server-actions";
import { isRedirectError } from "next/dist/client/components/redirect-error";
import { redirect } from "next/navigation";
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

  try {
    await signIn(logtoConfig, {
      redirectUri: `${logtoConfig.baseUrl}/api/logto/callback`,
      interactionMode,
    });
  } catch (error) {
    if (isRedirectError(error)) {
      throw error;
    }
    redirect("/login?error=session_unavailable");
  }
}
