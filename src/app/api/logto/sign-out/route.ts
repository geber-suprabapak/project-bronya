import { signOut } from "@logto/next/server-actions";
import { cookies } from "next/headers";
import { env } from "@/env";
import { logtoConfig } from "@/lib/logto/config";
import { getPostLogoutRedirectUri } from "@/lib/logto/post-logout-redirect";

export const dynamic = "force-dynamic";

export async function GET() {
  const cookieStore = await cookies();
  cookieStore.delete(`logto_${logtoConfig.appId}`);

  await signOut(
    logtoConfig,
    getPostLogoutRedirectUri(
      logtoConfig.baseUrl,
      env.LOGTO_POST_LOGOUT_REDIRECT_URI,
    ),
  );
}
