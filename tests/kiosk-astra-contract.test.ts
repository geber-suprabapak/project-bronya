import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("kiosk attendance does not claim success when Astra rejects the record", async () => {
  const source = await readFile(
    new URL("../src/app/(main)/presensi/actions.ts", import.meta.url),
    "utf8",
  );

  assert.doesNotMatch(
    source,
    /Local Database Direct Record|db\.insert\(absences\)/,
    "A kiosk must fail closed: it may not confirm attendance from a local fallback when Astra is unavailable.",
  );
  assert.match(
    source,
    /Gagal mencatat presensi ke Astra/,
    "Astra failures must be surfaced to the kiosk operator.",
  );
});
