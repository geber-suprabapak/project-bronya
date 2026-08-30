import assert from "node:assert/strict";
import test from "node:test";
import { getPostLogoutRedirectUri } from "../src/lib/logto/post-logout-redirect.ts";

test("post-logout redirect defaults to Bronya login", () => {
  assert.equal(
    getPostLogoutRedirectUri("https://kiosk.example", undefined),
    "https://kiosk.example/login",
  );
});

test("post-logout redirect rejects another origin", () => {
  assert.throws(
    () =>
      getPostLogoutRedirectUri(
        "https://kiosk.example",
        "https://evil.example/collect",
      ),
    /Bronya application origin/,
  );
});
