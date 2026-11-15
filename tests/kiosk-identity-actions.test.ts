import assert from "node:assert/strict";
import { register } from "node:module";
import test from "node:test";

register(new URL("./fixtures/kiosk-action-loader.mjs", import.meta.url));
const {
  checkAttendanceStatus,
  checkNisAndCreateAbsence,
  checkScheduleStatus,
  saveAttendance,
} = await import("../src/app/(main)/presensi/actions.ts");

declare global {
  var __mockLogtoContext:
    | { isAuthenticated: boolean; claims?: { roles?: string[] } }
    | undefined;
}

const unboundStudent = {
  student_id: "canonical-student-only",
  user_id: null,
  nis: "29901",
  full_name: "QA Roster A",
  class_name: "X PPLG 1",
};

function mockAstra(
  student: typeof unboundStudent | { user_id: string; nis: string },
  attendanceResponse: () => Response = () =>
    Response.json({
      success: true,
      data: [
        {
          user_id: "bound-user",
          action_type: "check_in",
          status: "Hadir",
        },
      ],
    }),
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
      return attendanceResponse();
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

test("attendance reads fail closed when Astra history is unavailable or malformed", async () => {
  const invalidResponses = [
    () => new Response(null, { status: 503 }),
    () => Response.json({ success: true, data: "malformed" }),
  ];

  for (const attendanceResponse of invalidResponses) {
    const statusAstra = mockAstra(
      { user_id: "bound-user", nis: "24003" },
      attendanceResponse,
    );
    try {
      const result = await checkAttendanceStatus("24003", 0, 0);
      assert.equal(result.success, false);
      assert.equal(result.data, undefined);
      assert.match(result.message, /riwayat presensi/);
    } finally {
      statusAstra.restore();
    }

    const saveAstra = mockAstra(
      { user_id: "bound-user", nis: "24003" },
      attendanceResponse,
    );
    try {
      const result = await saveAttendance("24003", "check_in", 0, 0);
      assert.equal(result.success, false);
      assert.match(result.message, /riwayat presensi/);
      assert(
        !saveAstra.paths.some((path) =>
          path.startsWith("/v1/admin/attendance/manual"),
        ),
      );
    } finally {
      saveAstra.restore();
    }
  }
});

test("kiosk server actions reject unauthenticated and non-operator callers before calling Astra", async () => {
  const deniedContexts = [
    { isAuthenticated: false },
    { isAuthenticated: true, claims: { roles: ["student"] } },
  ];

  for (const denied of deniedContexts) {
    globalThis.__mockLogtoContext = denied;
    const astra = mockAstra({ user_id: "bound-user", nis: "24003" });
    try {
      const sched = await checkScheduleStatus();
      assert.equal(sched.success, false);
      assert.match(sched.message, /Akses ditolak/);

      const status = await checkAttendanceStatus("24003", 0, 0);
      assert.equal(status.success, false);
      assert.match(status.message, /Akses ditolak/);

      const save = await saveAttendance("24003", "check_in", 0, 0);
      assert.equal(save.success, false);
      assert.match(save.message, /Akses ditolak/);

      const kiosk = await checkNisAndCreateAbsence("24003");
      assert.equal(kiosk.success, false);
      assert.match(kiosk.message, /Akses ditolak/);

      assert.deepEqual(astra.paths, []);
    } finally {
      astra.restore();
      globalThis.__mockLogtoContext = undefined;
    }
  }
});

test("check-out requires an existing check-in in both check and direct save actions", async () => {
  const originalFetch = globalThis.fetch;
  const paths: string[] = [];
  globalThis.fetch = async (input) => {
    const url = new URL(input instanceof Request ? input.url : String(input));
    paths.push(url.pathname + url.search);
    if (url.pathname === "/v1/admin/students") {
      return Response.json({
        success: true,
        data: [{ user_id: "bound-user", nis: "24003", full_name: "Budi" }],
      });
    }
    if (url.pathname === "/v1/admin/attendance") {
      return Response.json({ success: true, data: [] });
    }
    if (url.pathname === "/v1/admin/schedules") {
      return Response.json({
        success: true,
        data: [
          {
            day_of_week: url.searchParams.get("day_of_week"),
            is_active: true,
            mulai_masuk: "00:00",
            selesai_masuk: "00:00",
            kompensasi_waktu: 0,
            mulai_pulang: "00:01",
            selesai_pulang: "23:59",
          },
        ],
      });
    }
    throw new Error(`Unexpected Astra request: ${url.pathname}`);
  };

  try {
    const directSave = await saveAttendance("24003", "check_out", 0, 0);
    assert.equal(directSave.success, false);
    assert.match(directSave.message, /belum melakukan absensi masuk/);

    const wib = new Date(
      new Date().toLocaleString("en-US", { timeZone: "Asia/Jakarta" }),
    );
    if (wib.getHours() * 60 + wib.getMinutes() >= 1) {
      const kioskCheck = await checkNisAndCreateAbsence("24003");
      assert.equal(kioskCheck.success, false);
      assert.match(kioskCheck.message, /belum melakukan absensi masuk/);
    }

    assert(
      !paths.some((path) => path.startsWith("/v1/admin/attendance/manual")),
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("late check-in preserves Terlambat status when posting to Astra", async () => {
  const originalFetch = globalThis.fetch;
  const postedPayloads: string[] = [];

  const wib = new Date(
    new Date().toLocaleString("en-US", { timeZone: "Asia/Jakarta" }),
  );
  const currentMins = wib.getHours() * 60 + wib.getMinutes();
  const formatHhMm = (m: number) =>
    `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;

  // Configure schedule so current WIB minute falls inside the late grace window.
  const lateEndMins = Math.max(1, currentMins - 1);
  const graceMins = Math.min(1440, currentMins + 10) - lateEndMins;
  const checkoutStartMins = Math.min(1439, currentMins + 20);

  globalThis.fetch = async (input, init) => {
    const url = new URL(input instanceof Request ? input.url : String(input));
    if (url.pathname === "/v1/admin/students") {
      return Response.json({
        success: true,
        data: [{ user_id: "bound-user", nis: "24003", full_name: "Budi" }],
      });
    }
    if (url.pathname === "/v1/admin/attendance") {
      return Response.json({ success: true, data: [] });
    }
    if (url.pathname === "/v1/admin/schedules") {
      return Response.json({
        success: true,
        data: [
          {
            day_of_week: url.searchParams.get("day_of_week"),
            is_active: true,
            mulai_masuk: "00:00",
            selesai_masuk: formatHhMm(lateEndMins),
            kompensasi_waktu: graceMins,
            mulai_pulang: formatHhMm(checkoutStartMins),
            selesai_pulang: "23:59",
          },
        ],
      });
    }
    if (url.pathname === "/v1/admin/attendance/manual") {
      postedPayloads.push(String(init?.body ?? ""));
      return Response.json({ success: true });
    }
    throw new Error(`Unexpected Astra request: ${url.pathname}`);
  };

  try {
    if (currentMins >= 2 && currentMins <= 1418) {
      const result = await checkNisAndCreateAbsence("24003");
      assert.equal(result.success, true);
      assert.equal(result.data?.status, "Terlambat");
      assert.equal(postedPayloads.length, 1);
      const body = JSON.parse(postedPayloads[0] ?? "{}");
      assert.equal(body.status, "Terlambat");
      assert.equal(body.action_type, "check_in");
    }
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("inactive weekday schedule returns no_schedule and blocks kiosk attendance", async () => {
  const schedulePayloads = [
    { success: true, data: [] },
    {
      success: true,
      data: [
        {
          day_of_week: "senin",
          is_active: false,
          mulai_masuk: "06:30",
          selesai_masuk: "07:15",
        },
      ],
    },
  ];

  for (const payload of schedulePayloads) {
    const originalFetch = globalThis.fetch;
    const paths: string[] = [];
    globalThis.fetch = async (input) => {
      const url = new URL(input instanceof Request ? input.url : String(input));
      paths.push(url.pathname);
      if (url.pathname === "/v1/admin/students") {
        return Response.json({
          success: true,
          data: [{ user_id: "bound-user", nis: "24003", full_name: "Budi" }],
        });
      }
      if (url.pathname === "/v1/admin/attendance") {
        return Response.json({ success: true, data: [] });
      }
      if (url.pathname === "/v1/admin/schedules") {
        return Response.json(payload);
      }
      throw new Error(`Unexpected Astra request: ${url.pathname}`);
    };

    try {
      const sched = await checkScheduleStatus();
      assert.equal(sched.success, true);
      assert.equal(sched.timeWindow, "no_schedule");

      const kiosk = await checkNisAndCreateAbsence("24003");
      assert.equal(kiosk.success, false);
      assert.equal(kiosk.data?.status, "Tutup");
      assert(!paths.includes("/v1/admin/attendance/manual"));
    } finally {
      globalThis.fetch = originalFetch;
    }
  }
});

test("empty or non-numeric NIS and invalid saveAttendance inputs fail closed without Astra fetch", async () => {
  const astra = mockAstra({ user_id: "bound-user", nis: "24003" });
  try {
    for (const invalidNis of ["", "   ", "abc", "]C1"]) {
      const checkRes = await checkAttendanceStatus(invalidNis, 0, 0);
      assert.equal(checkRes.success, false);
      assert.match(checkRes.message, /NIS tidak valid/);

      const kioskRes = await checkNisAndCreateAbsence(invalidNis);
      assert.equal(kioskRes.success, false);

      const saveRes = await saveAttendance(invalidNis, "check_in", 0, 0);
      assert.equal(saveRes.success, false);
    }

    const badCoordRes = await saveAttendance("24003", "check_in", 999, 0);
    assert.equal(badCoordRes.success, false);
    assert.match(badCoordRes.message, /Input presensi tidak valid/);

    assert.deepEqual(astra.paths, []);
  } finally {
    astra.restore();
  }
});
