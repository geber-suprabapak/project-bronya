/**
 * Logto only accepts post-logout URLs registered on the application. Keep the
 * destination configuration-only and constrained to Bronya's own origin.
 */
export function getPostLogoutRedirectUri(
  baseUrl: string,
  configuredRedirectUri?: string,
): string {
  const applicationUrl = new URL(baseUrl);
  const redirectUrl = new URL(
    configuredRedirectUri ?? new URL("/login", applicationUrl).toString(),
  );

  if (redirectUrl.origin !== applicationUrl.origin) {
    throw new Error(
      "LOGTO_POST_LOGOUT_REDIRECT_URI must use the Bronya application origin.",
    );
  }

  return redirectUrl.toString();
}
