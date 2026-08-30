import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("missing production config is reported by health instead of crashing edge module evaluation", async () => {
  const source = await readFile(
    new URL("../src/env.js", import.meta.url),
    "utf8",
  );

  assert.doesNotMatch(source, /Missing required production configuration/);
  assert.doesNotMatch(source, /isNextProductionBuild/);
  assert.doesNotMatch(
    source,
    /ASTRA_API_URL:\s*z\.string\(\)\.url\(\)\.default/,
  );
});
