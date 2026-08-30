import { NextResponse } from "next/server";
import { env } from "@/env";
import { isBronyaRuntimeConfigured } from "@/lib/logto/config";

export async function GET() {
  const configured = isBronyaRuntimeConfigured();

  return NextResponse.json(
    {
      status: configured ? "ok" : "misconfigured",
      timestamp: new Date().toISOString(),
      dependencies: {
        astra: Boolean(env.ASTRA_API_URL && env.ASTRA_DEVICE_TOKEN),
        logto: Boolean(
          env.LOGTO_ENDPOINT &&
            env.LOGTO_APP_ID &&
            env.LOGTO_APP_SECRET &&
            env.LOGTO_BASE_URL &&
            env.LOGTO_COOKIE_SECRET &&
            env.LOGTO_RESOURCE,
        ),
      },
    },
    { status: configured ? 200 : 503 },
  );
}
