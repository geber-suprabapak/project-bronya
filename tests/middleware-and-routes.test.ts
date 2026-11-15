import assert from "node:assert/strict";
import { register } from "node:module";
import test from "node:test";
import { NextRequest } from "../node_modules/next/server.js";

register(new URL("./fixtures/middleware-route-loader.mjs", import.meta.url));

const { middleware } = await import("../src/middleware.ts");
const { GET: getHealth } = await import("../src/app/api/health/route.ts");
const { GET: getLogtoCallback } = await import(
  "../src/app/api/logto/callback/route.ts"
);
const { GET: getLogtoSignIn } = await import(
  "../src/app/api/logto/sign-in/route.ts"
);
const { GET: getLogtoUser } = await import(
  "../src/app/api/logto/user/route.ts"
);

declare global {
  var __mockEdgeLogtoContext:
    | { isAuthenticated: boolean; claims?: { roles?: string[] } }
    | undefined;
  var __mockEdgeLogtoError: Error | undefined;
  var __mockServerLogtoContext:
    | {
        isAuthenticated: boolean;
        claims?: {
          sub?: string;
          email?: string;
          name?: string;
          roles?: string[];
        };
        userInfo?: { email?: string; name?: string };
      }
    | undefined;
  var __mockServerLogtoError: Error | undefined;
  var __mockHandleSignInError:
    | (Error & { digest?: string; destination?: string })
    | undefined;
  var __mockSignInError:
    | (Error & { digest?: string; destination?: string })
    | undefined;
  var __mockMissingRuntimeVars: string[] | undefined;
  var __lastSignInOptions:
    | { redirectUri: string; interactionMode?: string }
    | undefined;
}

function resetMocks() {
  globalThis.__mockEdgeLogtoContext = undefined;
  globalThis.__mockEdgeLogtoError = undefined;
  globalThis.__mockServerLogtoContext = undefined;
  globalThis.__mockServerLogtoError = undefined;
  globalThis.__mockHandleSignInError = undefined;
  globalThis.__mockSignInError = undefined;
  globalThis.__mockMissingRuntimeVars = undefined;
  globalThis.__lastSignInOptions = undefined;
}

function assertSecurityHeaders(headers: Headers) {
  assert.equal(headers.get("X-Content-Type-Options"), "nosniff");
  assert.equal(headers.get("X-Frame-Options"), "DENY");
  assert.equal(
    headers.get("Referrer-Policy"),
    "strict-origin-when-cross-origin",
  );
  assert.equal(
    headers.get("Permissions-Policy"),
    "camera=(), microphone=(), geolocation=()",
  );
  assert.match(
    headers.get("Content-Security-Policy") ?? "",
    /frame-ancestors 'none'/,
  );
}

test("middleware enforces operator roles, protects nested asset paths, and attaches security headers", async () => {
  resetMocks();
  try {
    const unauthPresensi = await middleware(
      new NextRequest("https://bronya.skanida.test/presensi"),
    );
    assert.equal(unauthPresensi.status, 307);
    assert.equal(
      unauthPresensi.headers.get("location"),
      "https://bronya.skanida.test/login?redirect=%2Fpresensi",
    );
    assertSecurityHeaders(unauthPresensi.headers);

    const rootAsset = await middleware(
      new NextRequest("https://bronya.skanida.test/logo.svg"),
    );
    assert.equal(rootAsset.headers.get("x-middleware-next"), "1");
    assertSecurityHeaders(rootAsset.headers);

    const nestedAsset = await middleware(
      new NextRequest("https://bronya.skanida.test/private/report.svg"),
    );
    assert.equal(nestedAsset.status, 307);
    assert.equal(
      nestedAsset.headers.get("location"),
      "https://bronya.skanida.test/login?redirect=%2Fprivate%2Freport.svg",
    );

    globalThis.__mockEdgeLogtoContext = {
      isAuthenticated: true,
      claims: { roles: ["student"] },
    };
    const studentPresensi = await middleware(
      new NextRequest("https://bronya.skanida.test/presensi"),
    );
    assert.equal(studentPresensi.status, 307);
    assert.equal(
      studentPresensi.headers.get("location"),
      "https://bronya.skanida.test/login?error=forbidden_role",
    );
    assertSecurityHeaders(studentPresensi.headers);

    globalThis.__mockEdgeLogtoContext = {
      isAuthenticated: true,
      claims: { roles: ["school_admin"] },
    };
    const operatorLogin = await middleware(
      new NextRequest("https://bronya.skanida.test/login"),
    );
    assert.equal(operatorLogin.status, 307);
    assert.equal(
      operatorLogin.headers.get("location"),
      "https://bronya.skanida.test/presensi",
    );

    const operatorPresensi = await middleware(
      new NextRequest("https://bronya.skanida.test/presensi"),
    );
    assert.equal(operatorPresensi.headers.get("x-middleware-next"), "1");
    assertSecurityHeaders(operatorPresensi.headers);
  } finally {
    resetMocks();
  }
});

test("production fail-closed guard blocks unconfigured runtime across middleware, health, and Logto routes", async () => {
  resetMocks();
  const previousNodeEnv = process.env.NODE_ENV;
  try {
    const healthyRes = await getHealth();
    assert.equal(healthyRes.status, 200);
    const healthyBody = await healthyRes.json();
    assert.equal(healthyBody.status, "ok");
    assert.deepEqual(healthyBody.dependencies, { astra: true, logto: true });

    Reflect.set(process.env, "NODE_ENV", "production");
    globalThis.__mockMissingRuntimeVars = [
      "ASTRA_API_URL",
      "LOGTO_COOKIE_SECRET",
    ];

    const misconfiguredHealth = await getHealth();
    assert.equal(misconfiguredHealth.status, 503);
    const misconfiguredBody = await misconfiguredHealth.json();
    assert.equal(misconfiguredBody.status, "misconfigured");
    assert.deepEqual(misconfiguredBody.missingConfiguration, [
      "ASTRA_API_URL",
      "LOGTO_COOKIE_SECRET",
    ]);
    assert.deepEqual(misconfiguredBody.dependencies, {
      astra: false,
      logto: false,
    });

    const mwProtected = await middleware(
      new NextRequest("https://bronya.skanida.test/presensi"),
    );
    assert.equal(mwProtected.status, 307);
    assert.equal(
      mwProtected.headers.get("location"),
      "https://bronya.skanida.test/login?error=session_unavailable",
    );
    assertSecurityHeaders(mwProtected.headers);

    const mwPublic = await middleware(
      new NextRequest("https://bronya.skanida.test/api/health/live"),
    );
    assert.equal(mwPublic.headers.get("x-middleware-next"), "1");

    const userRes = await getLogtoUser();
    assert.equal(userRes.status, 503);
    assert.deepEqual(await userRes.json(), {
      isAuthenticated: false,
      user: null,
    });

    const signInRes = await getLogtoSignIn(
      new NextRequest("https://bronya.skanida.test/api/logto/sign-in"),
    );
    assert.equal(signInRes?.status, 503);

    const callbackRes = await getLogtoCallback(
      new NextRequest(
        "https://bronya.skanida.test/api/logto/callback?code=abc",
      ),
    );
    assert.equal(callbackRes?.status, 503);
  } finally {
    if (previousNodeEnv === undefined) {
      Reflect.deleteProperty(process.env, "NODE_ENV");
    } else {
      Reflect.set(process.env, "NODE_ENV", previousNodeEnv);
    }
    resetMocks();
  }
});

test("Logto callback, sign-in, and user routes handle OIDC failures and role boundaries without unhandled 500s", async () => {
  resetMocks();
  try {
    globalThis.__mockServerLogtoContext = {
      isAuthenticated: true,
      claims: {
        sub: "user-admin-1",
        email: "admin@skanida.test",
        roles: ["school_admin"],
      },
      userInfo: { name: "Operator Satu" },
    };

    const userOk = await getLogtoUser();
    assert.equal(userOk.status, 200);
    assert.deepEqual(await userOk.json(), {
      isAuthenticated: true,
      user: {
        id: "user-admin-1",
        email: "admin@skanida.test",
        name: "Operator Satu",
        role: "school_admin",
        isKioskOperator: true,
      },
    });

    globalThis.__mockServerLogtoError = new Error("Logto token expired");
    const userErr = await getLogtoUser();
    assert.equal(userErr.status, 401);
    assert.deepEqual(await userErr.json(), {
      isAuthenticated: false,
      user: null,
    });
    globalThis.__mockServerLogtoError = undefined;

    await assert.rejects(
      () =>
        getLogtoCallback(
          new NextRequest(
            "https://bronya.skanida.test/api/logto/callback?code=ok",
          ),
        ),
      (err: { destination?: string }) => err.destination === "/presensi",
    );

    globalThis.__mockServerLogtoContext = {
      isAuthenticated: true,
      claims: { sub: "student-1", roles: ["student"] },
    };
    await assert.rejects(
      () =>
        getLogtoCallback(
          new NextRequest(
            "https://bronya.skanida.test/api/logto/callback?code=student",
          ),
        ),
      (err: { destination?: string }) =>
        err.destination === "/login?error=forbidden_role",
    );

    globalThis.__mockHandleSignInError = new Error("OIDC state mismatch");
    await assert.rejects(
      () =>
        getLogtoCallback(
          new NextRequest(
            "https://bronya.skanida.test/api/logto/callback?error=access_denied",
          ),
        ),
      (err: { destination?: string }) =>
        err.destination === "/login?error=unauthorized",
    );
    globalThis.__mockHandleSignInError = undefined;

    const redirectSignal = Object.assign(new Error("NEXT_REDIRECT"), {
      digest: "NEXT_REDIRECT;replace;https://auth.skanida.test/oidc/auth;307;",
    });
    globalThis.__mockSignInError = redirectSignal;
    await assert.rejects(
      () =>
        getLogtoSignIn(
          new NextRequest(
            "https://bronya.skanida.test/api/logto/sign-in?interactionMode=invalid",
          ),
        ),
      (err: { digest?: string }) => err.digest === redirectSignal.digest,
    );
    assert.deepEqual(globalThis.__lastSignInOptions, {
      redirectUri: "https://bronya.skanida.test/api/logto/callback",
      interactionMode: undefined,
    });

    globalThis.__mockSignInError = new Error("Logto unreachable");
    await assert.rejects(
      () =>
        getLogtoSignIn(
          new NextRequest(
            "https://bronya.skanida.test/api/logto/sign-in?interactionMode=signIn",
          ),
        ),
      (err: { destination?: string }) =>
        err.destination === "/login?error=session_unavailable",
    );
    assert.equal(globalThis.__lastSignInOptions?.interactionMode, "signIn");
  } finally {
    resetMocks();
  }
});
