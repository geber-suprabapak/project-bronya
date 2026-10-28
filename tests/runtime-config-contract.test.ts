import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { GET as getLiveness } from "../src/app/api/health/live/route.ts";

test("Bronya health gate requires both Logto and Astra kiosk configuration", async () => {
  const source = await readFile(
    new URL("../src/app/api/health/route.ts", import.meta.url),
    "utf8",
  );

  assert.match(source, /isBronyaRuntimeConfigured/);
  assert.match(source, /startsWith\("ASTRA_"\)/);
  assert.match(source, /startsWith\("LOGTO_"\)/);
  assert.doesNotMatch(source, /ASTRA_DEVICE_TOKEN/);
  assert.match(source, /configured\s*\?\s*200\s*:\s*503/);
});

test("liveness stays public and healthy when runtime config is missing", async () => {
  const response = await getLiveness();
  assert.equal(response.status, 200);
  assert.equal((await response.json()).status, "ok");

  const middleware = await readFile(
    new URL("../src/middleware.ts", import.meta.url),
    "utf8",
  );
  assert.match(middleware, /pathname === "\/api\/health\/live"/);
});
