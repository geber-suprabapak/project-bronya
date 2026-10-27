import assert from "node:assert/strict";
import { register } from "node:module";
import test from "node:test";

register(new URL("./fixtures/kiosk-action-loader.mjs", import.meta.url));
const { checkAttendanceStatus, checkNisAndCreateAbsence, saveAttendance } =
  await import("../src/app/(main)/presensi/actions.ts");

const unboundStudent = {
  student_id: "canonical-student-only",
  user_id: null,
  nis: "29901",
  full_name: "QA Roster A",
  class_name: "X PPLG 1",
};

function mockAstra(
  student: typeof unboundStudent | { user_id: string; nis: string },
) {
  const original = globalThis.fetch;
  const paths: string[] = [];
  globalThis.fetch = async (input) => {
    const url = new URL(input instanceof Request ? input.url : String(input));
    paths.push(url.pathname + url.search);
    if (url.pathname === "/v1/admin/students") {
      return Response.json({ success: true, data: [student] });
    }
    if (url.pathname === "/v1/admin/attendance") {
      return Response.json({
        success: true,
        data: [
          {
            user_id: url.searchParams.get("userId") || "another-student",
            action_type: "check_in",
            status: "Hadir",
          },
        ],
      });
    }
    if (url.pathname === "/v1/admin/schedules") {
      return Response.json({
        success: true,
        data: [
          {
            day_of_week: url.searchParams.get("day_of_week"),
            is_active: true,
            mulai_masuk: "00:00",
            selesai_masuk: "23:59",
            mulai_pulang: "23:59",
            selesai_pulang: "23:59",
          },
        ],
      });
    }
    throw new Error(`Unexpected Astra request: ${url.pathname}`);
  };
  return {
    paths,
    restore: () => {
      globalThis.fetch = original;
    },
  };
}

test("unbound roster cannot borrow another student's attendance in any kiosk entry point", async () => {
  const calls = [
    () => checkAttendanceStatus("29901", 0, 0),
    () => checkNisAndCreateAbsence("29901"),
    () => saveAttendance("29901", "check_in", 0, 0),
  ];
  for (const call of calls) {
    const astra = mockAstra(unboundStudent);
    try {
      const result = await call();
      assert.equal(result.success, false);
      assert.match(result.message, /belum terhubung/);
      assert.equal(result.alreadyPresent, undefined);
      assert.equal(result.data, undefined);
      assert.deepEqual(astra.paths, ["/v1/admin/students"]);
    } finally {
      astra.restore();
    }
  }
});

test("bound barcode remains a duplicate and displays the WIB day on a UTC server", async () => {
  const astra = mockAstra({ user_id: "bound-user", nis: "24003" });
  const originalTimezone = process.env.TZ;
  process.env.TZ = "UTC";
  try {
    const result = await checkNisAndCreateAbsence("]C124003");
    assert.equal(result.success, false);
    assert.equal(result.alreadyPresent, true);
    assert.equal(result.data?.nis, "24003");
    const day = new Intl.DateTimeFormat("id-ID", {
      timeZone: "Asia/Jakarta",
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    }).format(new Date());
    assert(result.data?.date.startsWith(day));
    assert(
      astra.paths.some((path) =>
        path.startsWith("/v1/admin/attendance?userId=bound-user&"),
      ),
    );
    assert(
      !astra.paths.some((path) =>
        path.startsWith("/v1/admin/attendance/manual"),
      ),
    );
  } finally {
    astra.restore();
    if (originalTimezone === undefined) delete process.env.TZ;
    else process.env.TZ = originalTimezone;
  }
});
