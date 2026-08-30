import { NextResponse } from "next/server";
import {
  getMissingBronyaRuntimeVariables,
  isBronyaRuntimeConfigured,
} from "@/lib/logto/config";

export async function GET() {
  const configured = isBronyaRuntimeConfigured();
  const missing = getMissingBronyaRuntimeVariables();

  return NextResponse.json(
    {
      status: configured ? "ok" : "misconfigured",
      timestamp: new Date().toISOString(),
      missingConfiguration: missing,
      dependencies: {
        astra: !missing.some((name) => name.startsWith("ASTRA_")),
        logto: !missing.some((name) => name.startsWith("LOGTO_")),
      },
    },
    { status: configured ? 200 : 503 },
  );
}
