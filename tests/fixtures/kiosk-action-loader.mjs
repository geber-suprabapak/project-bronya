const stubs = new Map([
  [
    "@logto/next/server-actions",
    'export async function getAccessToken() { return "test-token" }',
  ],
  [
    "~/env",
    'export const env = { ASTRA_API_URL: "http://astra.test", LOGTO_RESOURCE: "https://api.test" }',
  ],
  ["~/lib/logto/config", "export const logtoConfig = {}"],
]);

export async function resolve(specifier, context, nextResolve) {
  if (stubs.has(specifier)) {
    return {
      url: `data:text/javascript,${encodeURIComponent(stubs.get(specifier))}`,
      shortCircuit: true,
    };
  }
  return nextResolve(specifier, context);
}
