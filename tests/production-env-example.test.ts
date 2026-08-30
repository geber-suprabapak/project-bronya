import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("production env example reaches the Skanida host rather than the Bronya container", async () => {
  const source = await readFile(
    new URL("../.env.example", import.meta.url),
    "utf8",
  );

  assert.match(source, /^ASTRA_API_URL=http:\/\/192\.168\.21\.121:23000$/m);
  assert.match(source, /^LOGTO_ENDPOINT=http:\/\/192\.168\.21\.121:23001$/m);
  assert.match(source, /^LOGTO_BASE_URL=http:\/\/192\.168\.21\.121:15000$/m);
  assert.doesNotMatch(source, /ASTRA_API_URL=http:\/\/localhost/);
  assert.doesNotMatch(source, /LOGTO_ENDPOINT=http:\/\/localhost/);
});
