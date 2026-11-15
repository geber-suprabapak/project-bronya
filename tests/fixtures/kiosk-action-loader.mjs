const stubs = new Map([
  [
    "@logto/next/server-actions",
    'export async function getAccessToken() { return "test-token"; }\nexport async function getLogtoContext() { return globalThis.__mockLogtoContext ?? { isAuthenticated: true, claims: { roles: ["school_admin"] } }; }',
  ],
  [
    "~/env",
    'export const env = { ASTRA_API_URL: "http://astra.test", LOGTO_RESOURCE: "https://api.test" }',
  ],
  ["~/lib/logto/config", "export const logtoConfig = {}"],
]);

export async function resolve(specifier, context, nextResolve) {
  if (specifier === "~/lib/logto/claims") {
    return nextResolve(
      new URL("../../src/lib/logto/claims.ts", import.meta.url).href,
      context,
    );
  }
  if (stubs.has(specifier)) {
    return {
      url: `data:text/javascript,${encodeURIComponent(stubs.get(specifier))}`,
      shortCircuit: true,
    };
  }
  return nextResolve(specifier, context);
}
