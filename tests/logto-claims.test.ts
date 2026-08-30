import assert from "node:assert/strict";
import test from "node:test";
import {
  isKioskOperatorRole,
  resolveLogtoRole,
} from "../src/lib/logto/claims.ts";

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
