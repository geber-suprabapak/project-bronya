import { getLogtoContext } from "@logto/next/server-actions";
import { redirect } from "next/navigation";
import {
  extractExtendedClaims,
  isKioskOperatorRole,
  resolveLogtoRole,
} from "@/lib/logto/claims";
import { logtoConfig } from "@/lib/logto/config";

export default async function Home() {
  const context = await getLogtoContext(logtoConfig).catch(() => null);
  const role = resolveLogtoRole(extractExtendedClaims(context?.claims)?.roles);

  redirect(
    context?.isAuthenticated && isKioskOperatorRole(role)
      ? "/presensi"
      : "/login",
  );
}
