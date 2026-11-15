const stubs = new Map([
  [
    "@logto/next/edge",
    `export default class LogtoClient {
      constructor(config) {
        globalThis.__lastLogtoClientConfig = config;
      }
      async getLogtoContext(request) {
        if (globalThis.__mockEdgeLogtoError) {
          throw globalThis.__mockEdgeLogtoError;
        }
        return globalThis.__mockEdgeLogtoContext ?? { isAuthenticated: false };
      }
    }`,
  ],
  [
    "@logto/next/server-actions",
    `export async function getLogtoContext() {
      if (globalThis.__mockServerLogtoError) {
        throw globalThis.__mockServerLogtoError;
      }
      return globalThis.__mockServerLogtoContext ?? { isAuthenticated: false };
    }
    export async function handleSignIn(_config, callbackUrl) {
      globalThis.__lastCallbackUrl = String(callbackUrl);
      if (globalThis.__mockHandleSignInError) {
        throw globalThis.__mockHandleSignInError;
      }
    }
    export async function signIn(_config, options) {
      globalThis.__lastSignInOptions = options;
      if (globalThis.__mockSignInError) {
        throw globalThis.__mockSignInError;
      }
    }`,
  ],
  [
    "next/navigation",
    `export function redirect(url) {
      const error = new Error("NEXT_REDIRECT");
      error.digest = \`NEXT_REDIRECT;replace;\${url};307;\`;
      error.destination = url;
      throw error;
    }`,
  ],
  [
    "next/dist/client/components/redirect-error",
    `export function isRedirectError(error) {
      return Boolean(error && typeof error === "object" && typeof error.digest === "string" && error.digest.startsWith("NEXT_REDIRECT;"));
    }`,
  ],
  [
    "@/lib/logto/config",
    `export const logtoConfig = {
      endpoint: "https://auth.skanida.test",
      appId: "bronya-app",
      baseUrl: "https://bronya.skanida.test",
    };
    export function getMissingBronyaRuntimeVariables() {
      return globalThis.__mockMissingRuntimeVars ?? [];
    }
    export function isBronyaRuntimeConfigured() {
      return (globalThis.__mockMissingRuntimeVars ?? []).length === 0;
    }`,
  ],
]);

export async function resolve(specifier, context, nextResolve) {
  if (specifier === "@/lib/logto/claims") {
    return nextResolve(
      new URL("../../src/lib/logto/claims.ts", import.meta.url).href,
      context,
    );
  }
  if (specifier === "next/server") {
    return nextResolve(
      new URL("../../node_modules/next/server.js", import.meta.url).href,
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
