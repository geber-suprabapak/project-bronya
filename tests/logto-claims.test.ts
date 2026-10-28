import assert from "node:assert/strict";
import test from "node:test";
import {
  extractExtendedClaims,
  isKioskOperatorRole,
  resolveLogtoRole,
} from "../src/lib/logto/claims.ts";

test("preserves SDK-typed roles without an assertion", () => {
  const claims = {
    iss: "https://auth.example.test/",
    sub: "operator-1",
    aud: "bronya-client",
    exp: 2_000_000_000,
    iat: 1_900_000_000,
    roles: ["school_admin"],
  };
  assert.deepEqual(extractExtendedClaims(claims)?.roles, ["school_admin"]);
});

test("school_admin is an authorized Bronya kiosk operator", () => {
  const role = resolveLogtoRole(["student", "school_admin"]);
  assert.equal(role, "school_admin");
  assert.equal(isKioskOperatorRole(role), true);
});

test("student-only claims cannot operate the Bronya kiosk", () => {
  const role = resolveLogtoRole(["student"]);
  assert.equal(role, "student");
  assert.equal(isKioskOperatorRole(role), false);
});
