import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path: string) =>
  readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("Bronya login uses Logto instead of a browser Supabase client", async () => {
  const [loginForm, middleware] = await Promise.all([
    read("src/components/login-form.tsx"),
    read("src/middleware.ts"),
  ]);

  assert.match(loginForm, /\/api\/logto\/sign-in/);
  assert.doesNotMatch(loginForm, /supabase|signInWithPassword/i);
  assert.match(middleware, /@logto\/next\/edge/);
  assert.doesNotMatch(middleware, /@supabase|supabase\.auth/i);
});

test("Logto routes use a fixed callback and expose session lifecycle endpoints", async () => {
  const [signIn, callback, signOut, user] = await Promise.all([
    read("src/app/api/logto/sign-in/route.ts"),
    read("src/app/api/logto/callback/route.ts"),
    read("src/app/api/logto/sign-out/route.ts"),
    read("src/app/api/logto/user/route.ts"),
  ]);

  assert.match(signIn, /redirectUri:[\s\S]*api\/logto\/callback/);
  assert.match(callback, /handleSignIn\(logtoConfig, callbackUrl\)/);
  assert.match(callback, /isKioskOperatorRole/);
  assert.match(signOut, /getPostLogoutRedirectUri/);
  assert.match(signOut, /cookieStore\.delete/);
  assert.match(user, /getLogtoContext/);
});

test("production configuration names cover both Astra and Logto boundaries", async () => {
  const [env, example, docs] = await Promise.all([
    read("src/env.js"),
    read(".env.example"),
    read("DOCKER.md"),
  ]);

  for (const name of [
    "ASTRA_API_URL",
    "LOGTO_ENDPOINT",
    "LOGTO_APP_ID",
    "LOGTO_APP_SECRET",
    "LOGTO_COOKIE_SECRET",
    "LOGTO_BASE_URL",
    "LOGTO_RESOURCE",
    "LOGTO_POST_LOGOUT_REDIRECT_URI",
  ]) {
    assert.match(env, new RegExp(name));
    assert.match(example, new RegExp(`^${name}=`, "m"));
    assert.match(docs, new RegExp(name));
  }

  assert.match(example, /current authenticated Logto access token/i);
  assert.doesNotMatch(example, /^ASTRA_DEVICE_TOKEN=/m);
  assert.doesNotMatch(env, /NEXT_PUBLIC_SUPABASE/);
});
