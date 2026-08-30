import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

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
