import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("kiosk attendance does not claim success when Astra rejects the record", async () => {
  const source = await readFile(
    new URL("../src/app/(main)/presensi/actions.ts", import.meta.url),
    "utf8",
  );

  assert.match(source, /getAccessTokenRSC/);
  assert.doesNotMatch(source, /ASTRA_DEVICE_TOKEN/);
  assert.match(source, /Gagal mencatat presensi ke Astra/);
});
