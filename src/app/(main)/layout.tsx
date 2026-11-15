import { getLogtoContext } from "@logto/next/server-actions";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import {
  extractExtendedClaims,
  isKioskOperatorRole,
  resolveLogtoRole,
} from "@/lib/logto/claims";
import { isBronyaRuntimeConfigured, logtoConfig } from "@/lib/logto/config";

export const dynamic = "force-dynamic";

export default async function MainLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  if (process.env.NODE_ENV === "production" && !isBronyaRuntimeConfigured()) {
    redirect("/login?error=session_unavailable");
  }

  const context = await getLogtoContext(logtoConfig).catch(() => null);
  const role = resolveLogtoRole(extractExtendedClaims(context?.claims)?.roles);

  if (!context?.isAuthenticated) {
    redirect("/login");
  }

  if (!isKioskOperatorRole(role)) {
    redirect("/login?error=forbidden_role");
  }

  return children;
}
