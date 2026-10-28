import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { z } from "zod";

// Astra API Contract Schema Definition (from project-astra/src/modules/admin/schema.ts)
const createManualAttendanceSchema = z
  .object({
    user_id: z.string().min(1, "User ID is required.").optional(),
    userId: z.string().min(1, "User ID is required.").optional(),
    action_type: z.enum(["check_in", "check_out"]).optional(),
    actionType: z.enum(["check_in", "check_out"]).optional(),
    status: z.enum(["Hadir", "Terlambat", "Pulang", "Alpha"]).optional(),
    reason: z.string().min(3, "Reason must be at least 3 characters.").max(500),
    date: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be YYYY-MM-DD")
      .optional(),
    attempt_id: z.string().min(1).nullable().optional(),
    attemptId: z.string().min(1).nullable().optional(),
    latitude: z.number().optional(),
    longitude: z.number().optional(),
  })
  .refine((data) => Boolean(data.user_id || data.userId), {
    message: "User ID is required.",
    path: ["user_id"],
  })
  .refine((data) => Boolean(data.action_type || data.actionType), {
    message: "Action type is required.",
    path: ["action_type"],
  });

const readActionsSource = () =>
  readFile(
    new URL("../src/app/(main)/presensi/actions.ts", import.meta.url),
    "utf8",
  );

test("Challenge 1: Contract Conformance - Required Astra Headers & Auth", async () => {
  const source = await readActionsSource();

  // 1. Contract version header must be explicitly set to v1
  assert.match(
    source,
    /"X-Astra-Contract-Version":\s*"v1"/,
    "Missing or invalid X-Astra-Contract-Version: v1 header in astraHeaders",
  );

  // 2. Authorization header must use Bearer token pattern
  assert.match(
    source,
    /Authorization:\s*`Bearer \$\{accessToken\}`/,
    "Missing standard Bearer authorization header",
  );

  // 3. Content-Type header must be application/json
  assert.match(
    source,
    /"Content-Type":\s*"application\/json"/,
    "Missing Content-Type: application/json header",
  );

  // 4. Must obtain access token for LOGTO_RESOURCE
  assert.match(
    source,
    /getAccessToken\(logtoConfig,\s*env\.LOGTO_RESOURCE\)/,
    "Access token must be fetched for the configured Logto resource",
  );

  // 5. Must NOT use deprecated ASTRA_DEVICE_TOKEN
  assert.doesNotMatch(
    source,
    /ASTRA_DEVICE_TOKEN/,
    "Must not rely on static device token",
  );
});

test("Challenge 2: Contract Conformance - Endpoints & HTTP Methods", async () => {
  const source = await readActionsSource();

  // 1. Student directory endpoint
  assert.match(
    source,
    /fetch\(`\$\{astraApiUrl\(\)\}\/v1\/admin\/students`/,
    "Must query GET /v1/admin/students",
  );

  // 2. Manual attendance submission endpoint
  assert.match(
    source,
    /fetch\(\s*`\$\{astraApiUrl\(\)\}\/v1\/admin\/attendance\/manual`/,
    "Must submit to POST /v1/admin/attendance/manual",
  );

  // 3. POST method explicitly set for manual attendance
  assert.match(
    source,
    /method:\s*"POST"/,
    "Attendance submission must use POST method",
  );

  // 4. Timeout configured for both calls
  const matches = source.match(/AbortSignal\.timeout\(3000\)/g);
  assert.ok(
    matches && matches.length >= 2,
    "Must use AbortSignal.timeout(3000) for both Astra fetch operations",
  );
});

test("Challenge 3: Contract Conformance - createManualAttendanceSchema Status & Fields", async () => {
  const sampleUserId = "of5l0btx7gdy";
  const todayStr = new Date().toISOString().split("T")[0] ?? "2026-08-31";

  // 1. Valid check-in payload (status 'Hadir')
  const checkInPayload = {
    user_id: sampleUserId,
    action_type: "check_in",
    status: "Hadir",
    date: todayStr,
    latitude: -7.44998,
    longitude: 110.2236,
    reason: "Kiosk terminal scan",
  };
  const parsedCheckIn = createManualAttendanceSchema.safeParse(checkInPayload);
  assert.equal(parsedCheckIn.success, true);

  // 2. Valid check-out payload (status 'Pulang')
  const checkOutPayload = {
    user_id: sampleUserId,
    action_type: "check_out",
    status: "Pulang",
    date: todayStr,
    latitude: -7.44998,
    longitude: 110.2236,
    reason: "Kiosk terminal scan",
  };
  const parsedCheckOut =
    createManualAttendanceSchema.safeParse(checkOutPayload);
  assert.equal(parsedCheckOut.success, true);

  // 3. Complete enum check: Hadir, Terlambat, Pulang, Alpha
  const allowedStatuses = ["Hadir", "Terlambat", "Pulang", "Alpha"] as const;
  for (const status of allowedStatuses) {
    const payload = {
      user_id: sampleUserId,
      action_type: "check_in",
      status,
      reason: "Kiosk terminal scan",
    };
    const res = createManualAttendanceSchema.safeParse(payload);
    assert.equal(res.success, true, `Status ${status} must be accepted`);
  }

  // 4. Rejected invalid statuses (e.g., Sakit, Izin, Masuk, Done)
  const rejectedStatuses = [
    "Sakit",
    "Izin",
    "Masuk",
    "Done",
    "hadir",
    "pulang",
  ];
  for (const status of rejectedStatuses) {
    const payload = {
      user_id: sampleUserId,
      action_type: "check_in" as const,
      status,
      reason: "Kiosk terminal scan",
    };
    const res = createManualAttendanceSchema.safeParse(payload);
    assert.equal(res.success, false, `Status ${status} must be rejected`);
  }

  // 5. Date validation: YYYY-MM-DD pattern
  assert.equal(
    createManualAttendanceSchema.safeParse({
      user_id: sampleUserId,
      action_type: "check_in",
      date: "2026-08-31",
      reason: "Kiosk terminal scan",
    }).success,
    true,
  );
  assert.equal(
    createManualAttendanceSchema.safeParse({
      user_id: sampleUserId,
      action_type: "check_in",
      date: "31-08-2026", // Wrong format
      reason: "Kiosk terminal scan",
    }).success,
    false,
  );

  // 6. Reason validation: length [3, 500]
  assert.equal(
    createManualAttendanceSchema.safeParse({
      user_id: sampleUserId,
      action_type: "check_in",
      reason: "ab", // Too short (<3)
    }).success,
    false,
  );
  assert.equal(
    createManualAttendanceSchema.safeParse({
      user_id: sampleUserId,
      action_type: "check_in",
      reason: "Kiosk terminal scan", // 19 chars -> valid
    }).success,
    true,
  );
  assert.equal(
    createManualAttendanceSchema.safeParse({
      user_id: sampleUserId,
      action_type: "check_in",
      reason: "x".repeat(501), // Too long (>500)
    }).success,
    false,
  );
});

interface MockStudent {
  id?: string;
  user_id?: string;
  userId?: string;
  nis?: string;
  full_name?: string;
  fullName?: string;
  class_name?: string;
  className?: string;
  gender?: string | null;
  absence_number?: string | null;
  absenceNumber?: string | null;
  avatar_url?: string | null;
  avatarUrl?: string | null;
  role?: string;
  lifecycle_status?: string;
  email?: string | null;
}

test("Challenge 4: Student Lookup - NIS Sanitization, Exact Matching & Field Mapping", async () => {
  const sanitizeNis = (input: string) => {
    const clean = input.replace(/^\][A-Za-z]\d/, "");
    return clean.replace(/\D/g, "");
  };

  // 1. Test NIS sanitization edge cases
  assert.equal(sanitizeNis("17706"), "17706");
  assert.equal(sanitizeNis("]C117706"), "17706"); // Code 128 barcode
  assert.equal(sanitizeNis("]c117706"), "17706"); // Lowercase barcode
  assert.equal(sanitizeNis("]A017706"), "17706"); // Code 39
  assert.equal(sanitizeNis("]Q117706"), "17706"); // QR Code
  assert.equal(sanitizeNis("]d217706"), "17706"); // DataMatrix
  assert.equal(sanitizeNis(" 17706 "), "17706"); // Whitespace
  assert.equal(sanitizeNis("\t17706\r\n"), "17706"); // Whitespace / newline
  assert.equal(sanitizeNis("NIS-17706"), "17706"); // Punctuation
  assert.equal(sanitizeNis(""), ""); // Empty
  assert.equal(sanitizeNis("abc"), ""); // Non-numeric

  // Mock student directory data from Astra
  const mockAstraStudents: MockStudent[] = [
    {
      id: "6e2820dc-e24c-4735-8664-98444a7efc87",
      user_id: "of5l0btx7gdy",
      nis: "17706",
      full_name: "HAFIZ RAYAN KURNIAWAN",
      class_name: "XII PPLG1",
      gender: "male",
      absence_number: "15",
      role: "student",
      lifecycle_status: "approved",
    },
    {
      id: "7f3931ed-f35d-4846-9775-09555b8fgd98",
      user_id: "student_user_2",
      nis: "1770",
      full_name: "PREFIX STUDENT",
      class_name: "XII PPLG1",
    },
    {
      id: "8a4042fe-a46e-5957-a886-10666c9ghe09",
      user_id: "student_user_3",
      nis: "177060",
      full_name: "SUFFIX STUDENT",
      class_name: "XII PPLG1",
    },
  ];

  // Lookup resolution logic from actions.ts
  const resolveStudent = (
    data: { data?: MockStudent[] } | MockStudent[],
    rawNis: string,
  ) => {
    const cleanNis = sanitizeNis(rawNis);
    const students = Array.isArray(data) ? data : (data.data ?? []);

    const student = students.find((s) => s.nis === cleanNis);
    if (!student) return null;

    return {
      id: student.id || student.user_id || student.userId || "",
      userId: student.user_id || student.userId || student.id || "",
      nis: student.nis || cleanNis,
      fullName: student.full_name || student.fullName || `Siswa ${cleanNis}`,
      className: student.class_name || student.className || "-",
      role: student.role || "student",
      gender: student.gender || null,
      absenceNumber: student.absence_number || student.absenceNumber || null,
      avatarUrl: student.avatar_url || student.avatarUrl || null,
      email: student.email || null,
    };
  };

  // 2. Exact match verification (does not confuse prefix 1770 or suffix 177060 with 17706)
  const resolved = resolveStudent({ data: mockAstraStudents }, "17706");
  assert.ok(resolved);
  assert.equal(resolved.userId, "of5l0btx7gdy");
  assert.equal(resolved.fullName, "HAFIZ RAYAN KURNIAWAN");
  assert.equal(resolved.className, "XII PPLG1");
  assert.equal(resolved.absenceNumber, "15");
  assert.equal(resolved.gender, "male");

  // 3. Barcode scanner simulation (input "]C117706")
  const resolvedBarcode = resolveStudent(
    { data: mockAstraStudents },
    "]C117706",
  );
  assert.ok(resolvedBarcode);
  assert.equal(resolvedBarcode.userId, "of5l0btx7gdy");

  // 4. Missing student verification (returns null)
  assert.equal(resolveStudent({ data: mockAstraStudents }, "99999"), null);
  assert.equal(resolveStudent({ data: mockAstraStudents }, ""), null);

  // 5. Fallback values for incomplete profiles
  const incompleteStudent: MockStudent[] = [
    {
      user_id: "sparse_user",
      nis: "12345",
    },
  ];
  const resolvedIncomplete = resolveStudent(incompleteStudent, "12345");
  assert.ok(resolvedIncomplete);
  assert.equal(resolvedIncomplete.userId, "sparse_user");
  assert.equal(resolvedIncomplete.fullName, "Siswa 12345");
  assert.equal(resolvedIncomplete.className, "-");
  assert.equal(resolvedIncomplete.role, "student");
});

test("Challenge 5: Attendance Payload Assembly & Error Safety", async () => {
  const source = await readActionsSource();

  // 1. Verify findUserByNis is called before POST to Astra
  assert.match(
    source,
    /const cleanNis = sanitizeNis\(nis\);[\s\S]*const userProfile = await findUserByNis\(cleanNis\);[\s\S]*if \(!userProfile\) \{[\s\S]*return \{[\s\S]*success: false,/,
    "saveAttendance must validate and resolve student before submission",
  );

  // 2. Verify bound payload fields
  assert.match(
    source,
    /user_id:\s*userProfile\.userId,/,
    "Payload must bind user_id to resolved student's userId",
  );
  assert.match(
    source,
    /action_type:\s*actionType,/,
    "Payload must specify action_type",
  );
  assert.match(source, /status:\s*statusLabel,/, "Payload must specify status");
  assert.match(
    source,
    /date:\s*todayStr,/,
    "Payload must specify ISO date string",
  );
  assert.match(
    source,
    /latitude,[\s\S]*longitude,/,
    "Payload must forward latitude and longitude",
  );
  assert.match(
    source,
    /reason:\s*"Kiosk terminal scan",/,
    "Payload must provide valid reason string",
  );

  // 3. Verify HTTP error rejection handling
  assert.match(
    source,
    /if \(!astraRes\.ok\) \{[\s\S]*return \{[\s\S]*success: false,[\s\S]*message: `Gagal mencatat presensi ke Astra \(HTTP \$\{astraRes\.status\}\)\.`,/,
    "saveAttendance must catch HTTP errors and return failure without throwing",
  );
});

test("Challenge 6: Astra Response Envelope Variations & Fallbacks", () => {
  const sanitizeNis = (input: string) => {
    const clean = input.replace(/^\][A-Za-z]\d/, "");
    return clean.replace(/\D/g, "");
  };

  type MockStudentsPayload =
    | MockStudent[]
    | {
        data?: MockStudent[] | null | string | object;
        success?: boolean;
        message?: string;
      };

  const resolveStudentFromPayload = (
    data: MockStudentsPayload,
    rawNis: string,
  ) => {
    const cleanNis = sanitizeNis(rawNis);
    const students = Array.isArray(data)
      ? data
      : Array.isArray(data.data)
        ? data.data
        : [];

    const student = students.find((s) => s?.nis === cleanNis);
    if (!student) return null;

    return {
      id: student.id || student.user_id || student.userId || "",
      userId: student.user_id || student.userId || student.id || "",
      nis: student.nis || cleanNis,
      fullName: student.full_name || student.fullName || `Siswa ${cleanNis}`,
      className: student.class_name || student.className || "-",
      role: student.role || "student",
      gender: student.gender || null,
      absenceNumber: student.absence_number || student.absenceNumber || null,
      avatarUrl: student.avatar_url || student.avatarUrl || null,
      email: student.email || null,
    };
  };

  // 1. Empty students array
  assert.equal(
    resolveStudentFromPayload({ success: true, data: [] }, "17706"),
    null,
  );

  // 2. null data
  assert.equal(
    resolveStudentFromPayload({ success: false, data: null }, "17706"),
    null,
  );

  // 3. undefined data
  assert.equal(
    resolveStudentFromPayload({ success: false, message: "Error" }, "17706"),
    null,
  );

  // 4. Non-array data (object or string)
  assert.equal(
    resolveStudentFromPayload({ success: true, data: {} }, "17706"),
    null,
  );
  assert.equal(
    resolveStudentFromPayload({ success: true, data: "corrupted" }, "17706"),
    null,
  );

  // 5. Direct array without envelope
  const directArray = [
    { user_id: "direct_u1", nis: "17706", full_name: "Direct Student" },
  ];
  const directResolved = resolveStudentFromPayload(directArray, "17706");
  assert.ok(directResolved);
  assert.equal(directResolved.userId, "direct_u1");
  assert.equal(directResolved.fullName, "Direct Student");
});

test("Challenge 7: Schedule Status & Time Window Computations", () => {
  const DAYS_ID = [
    "minggu",
    "senin",
    "selasa",
    "rabu",
    "kamis",
    "jumat",
    "sabtu",
  ];
  assert.equal(DAYS_ID[1], "senin");

  interface ScheduleConfig {
    mulaiMasuk: string;
    selesaiMasuk: string;
    mulaiPulang: string;
    selesaiPulang: string;
    kompensasiWaktu: number;
  }

  const DEFAULT_SCHEDULES = {
    senin: {
      mulaiMasuk: "06:30",
      selesaiMasuk: "07:15",
      mulaiPulang: "15:30",
      selesaiPulang: "17:00",
      kompensasiWaktu: 15,
    },
    selasa: {
      mulaiMasuk: "06:30",
      selesaiMasuk: "07:15",
      mulaiPulang: "15:30",
      selesaiPulang: "17:00",
      kompensasiWaktu: 15,
    },
    jumat: {
      mulaiMasuk: "06:30",
      selesaiMasuk: "07:00",
      mulaiPulang: "11:30",
      selesaiPulang: "13:00",
      kompensasiWaktu: 15,
    },
    sabtu: {
      mulaiMasuk: "06:00",
      selesaiMasuk: "23:59",
      mulaiPulang: "11:00",
      selesaiPulang: "23:59",
      kompensasiWaktu: 60,
    },
  } satisfies Record<string, ScheduleConfig>;

  const toMinutes = (t: string) => {
    const [h, m] = t.split(":").map(Number);
    return (h ?? 0) * 60 + (m ?? 0);
  };

  const evaluateSchedule = (day: string, timeStr: string) => {
    const schedDef = DEFAULT_SCHEDULES[day] ?? {
      mulaiMasuk: "06:00",
      selesaiMasuk: "23:59",
      mulaiPulang: "11:00",
      selesaiPulang: "23:59",
      kompensasiWaktu: 60,
    };
    const mins = toMinutes(timeStr);
    const masukStart = toMinutes(schedDef.mulaiMasuk);
    const masukEnd = toMinutes(schedDef.selesaiMasuk);
    const masukLate = masukEnd + schedDef.kompensasiWaktu;
    const pulangStart = toMinutes(schedDef.mulaiPulang);
    const pulangEnd = toMinutes(schedDef.selesaiPulang);

    return mins >= masukStart && mins <= masukEnd
      ? "check_in"
      : mins > masukEnd && mins <= masukLate
        ? "late"
        : mins >= pulangStart && mins <= pulangEnd
          ? "check_out"
          : "check_in";
  };

  // On Monday (Senin)
  assert.equal(evaluateSchedule("senin", "06:45"), "check_in"); // Normal check-in
  assert.equal(evaluateSchedule("senin", "07:20"), "late"); // Late (within compensation window 07:15 - 07:30)
  assert.equal(evaluateSchedule("senin", "16:00"), "check_out"); // Check-out window
});

test("Challenge 8: High-Scale Directory Search Performance (10,000 students)", () => {
  const sanitizeNis = (input: string) => {
    const clean = input.replace(/^\][A-Za-z]\d/, "");
    return clean.replace(/\D/g, "");
  };

  // Generate 10,000 student records
  const bigStudentList = Array.from({ length: 10000 }, (_, i) => ({
    id: `id-${10000 + i}`,
    user_id: `user-${10000 + i}`,
    nis: `${10000 + i}`,
    full_name: `Student ${10000 + i}`,
    class_name: `XII PPLG ${1 + (i % 3)}`,
  }));

  const start = performance.now();
  const cleanTarget = sanitizeNis("]C117706");
  const found = bigStudentList.find((s) => s.nis === cleanTarget);
  const duration = performance.now() - start;

  assert.ok(found);
  assert.equal(found.nis, "17706");
  assert.equal(found.full_name, "Student 17706");
  assert.ok(
    duration < 50,
    `10,000 student lookup took ${duration}ms, must be < 50ms`,
  );
});

test("Challenge 9: Attendance 3-Step Lifecycle & Anti-Duplicate State Evaluation", () => {
  type ScheduleTimeWindow =
    | "before_check_in"
    | "check_in"
    | "late"
    | "between_windows"
    | "check_out"
    | "after_check_out";

  interface AttendanceRecord {
    action_type?: string;
    status?: string;
  }

  const evaluateAttendanceAction = (
    timeWindow: ScheduleTimeWindow,
    records: AttendanceRecord[],
  ) => {
    const hasCheckedIn = records.some(
      (r) =>
        r.action_type === "check_in" ||
        r.status === "Hadir" ||
        r.status === "Terlambat",
    );
    const hasCheckedOut = records.some(
      (r) => r.action_type === "check_out" || r.status === "Pulang",
    );

    if (hasCheckedOut) {
      return {
        actionable: false,
        actionType: "none",
        status: "Selesai",
        alreadyPresent: true,
      };
    }

    if (timeWindow === "before_check_in") {
      return {
        actionable: false,
        actionType: "none",
        status: "Belum Waktunya",
        alreadyPresent: hasCheckedIn,
      };
    }

    if (timeWindow === "check_in" || timeWindow === "late") {
      if (hasCheckedIn) {
        return {
          actionable: false,
          actionType: "none",
          status: "Sudah Masuk",
          alreadyPresent: true,
        };
      }
      return {
        actionable: true,
        actionType: "check_in",
        status: timeWindow === "late" ? "Terlambat" : "Hadir",
        alreadyPresent: false,
      };
    }

    if (timeWindow === "between_windows") {
      if (hasCheckedIn) {
        return {
          actionable: false,
          actionType: "none",
          status: "Menunggu Pulang",
          alreadyPresent: true,
        };
      }
      return {
        actionable: false,
        actionType: "none",
        status: "Waktu Habis",
        alreadyPresent: false,
      };
    }

    if (timeWindow === "check_out") {
      return {
        actionable: true,
        actionType: "check_out",
        status: "Pulang",
        alreadyPresent: false,
      };
    }

    return {
      actionable: false,
      actionType: "none",
      status: hasCheckedIn ? "Selesai" : "Tutup",
      alreadyPresent: hasCheckedIn || hasCheckedOut,
    };
  };

  // Step 1: Pagi belum absen -> actionable check_in
  const step1 = evaluateAttendanceAction("check_in", []);
  assert.equal(step1.actionable, true);
  assert.equal(step1.actionType, "check_in");
  assert.equal(step1.status, "Hadir");

  // Step 1.2: Pagi sudah absen masuk -> ditolak (anti-duplicate)
  const step1Duplicate = evaluateAttendanceAction("check_in", [
    { action_type: "check_in", status: "Hadir" },
  ]);
  assert.equal(step1Duplicate.actionable, false);
  assert.equal(step1Duplicate.actionType, "none");
  assert.equal(step1Duplicate.alreadyPresent, true);
  assert.equal(step1Duplicate.status, "Sudah Masuk");

  // Step 2.1: Siang antara jam masuk & pulang (belum absen) -> ditolak waktu habis
  const step2NoCheckin = evaluateAttendanceAction("between_windows", []);
  assert.equal(step2NoCheckin.actionable, false);
  assert.equal(step2NoCheckin.status, "Waktu Habis");

  // Step 2.2: Siang antara jam masuk & pulang (sudah absen masuk) -> menunggu pulang
  const step2Waiting = evaluateAttendanceAction("between_windows", [
    { action_type: "check_in", status: "Hadir" },
  ]);
  assert.equal(step2Waiting.actionable, false);
  assert.equal(step2Waiting.status, "Menunggu Pulang");

  // Step 3: Sore jam pulang -> actionable check_out
  const step3 = evaluateAttendanceAction("check_out", [
    { action_type: "check_in", status: "Hadir" },
  ]);
  assert.equal(step3.actionable, true);
  assert.equal(step3.actionType, "check_out");
  assert.equal(step3.status, "Pulang");

  // Step 4: Setelah absen pulang -> ditolak & status Selesai
  const step4 = evaluateAttendanceAction("check_out", [
    { action_type: "check_in", status: "Hadir" },
    { action_type: "check_out", status: "Pulang" },
  ]);
  assert.equal(step4.actionable, false);
  assert.equal(step4.status, "Selesai");
  assert.equal(step4.alreadyPresent, true);
});

test("Challenge 10: Strict Schedule Time Window Calculations", () => {
  const toMinutes = (t: string) => {
    const [h, m] = t.split(":").map(Number);
    return (h ?? 0) * 60 + (m ?? 0);
  };

  const getWindow = (
    timeStr: string,
    sched: {
      mulaiMasuk: string;
      selesaiMasuk: string;
      mulaiPulang: string;
      selesaiPulang: string;
      kompensasiWaktu: number;
    },
  ) => {
    const mins = toMinutes(timeStr);
    const masukStart = toMinutes(sched.mulaiMasuk);
    const masukEnd = toMinutes(sched.selesaiMasuk);
    const masukLate = masukEnd + sched.kompensasiWaktu;
    const pulangStart = toMinutes(sched.mulaiPulang);
    const pulangEnd = toMinutes(sched.selesaiPulang);

    if (mins < masukStart) return "before_check_in";
    if (mins <= masukEnd) return "check_in";
    if (mins <= masukLate) return "late";
    if (mins < pulangStart) return "between_windows";
    if (mins <= pulangEnd) return "check_out";
    return "after_check_out";
  };

  const sched = {
    mulaiMasuk: "06:30",
    selesaiMasuk: "07:15",
    mulaiPulang: "15:30",
    selesaiPulang: "17:00",
    kompensasiWaktu: 15,
  };

  assert.equal(getWindow("06:00", sched), "before_check_in");
  assert.equal(getWindow("06:30", sched), "check_in");
  assert.equal(getWindow("07:00", sched), "check_in");
  assert.equal(getWindow("07:15", sched), "check_in");
  assert.equal(getWindow("07:20", sched), "late");
  assert.equal(getWindow("07:30", sched), "late");
  assert.equal(getWindow("07:31", sched), "between_windows");
  assert.equal(getWindow("12:00", sched), "between_windows");
  assert.equal(getWindow("15:30", sched), "check_out");
  assert.equal(getWindow("16:30", sched), "check_out");
  assert.equal(getWindow("17:00", sched), "check_out");
  assert.equal(getWindow("17:01", sched), "after_check_out");
  assert.equal(getWindow("20:00", sched), "after_check_out");
});

test("Challenge 11: Astra Schedule Schema Mapping & Key Fallbacks", async () => {
  const source = await readActionsSource();

  // 1. Verify schedule endpoint query in source
  assert.match(
    source,
    /fetch\(\s*`\$\{astraApiUrl\(\)\}\/v1\/admin\/schedules\?day_of_week=\$\{encodeURIComponent\(day\)\}&is_active=true`/,
    "Must query GET /v1/admin/schedules with day_of_week and is_active=true",
  );

  // 2. Schedule normalization function logic
  interface TestAstraSchedule {
    id?: string;
    day_of_week?: string;
    hari?: string;
    start_time?: string;
    startTime?: string;
    end_time?: string;
    endTime?: string;
    start_checkout?: string;
    startCheckout?: string;
    end_checkout?: string;
    endCheckout?: string;
    mulai_masuk?: string | null;
    mulaiMasuk?: string | null;
    selesai_masuk?: string | null;
    selesaiMasuk?: string | null;
    mulai_pulang?: string | null;
    mulaiPulang?: string | null;
    selesai_pulang?: string | null;
    selesaiPulang?: string | null;
    kompensasi_waktu?: number | null;
    kompensasiWaktu?: number | null;
    grace_period_minutes?: number | null;
    gracePeriodMinutes?: number | null;
    is_active?: boolean;
    isActive?: boolean;
  }

  const parseSchedule = (schedules: TestAstraSchedule[], day: string) => {
    const active = schedules.find(
      (s) =>
        (s.day_of_week === day || s.hari === day) &&
        s.is_active !== false &&
        s.isActive !== false,
    );
    if (!active) return null;

    const normalizeTime = (t?: string | null) => (t ? t.slice(0, 5) : null);

    const mulaiMasuk =
      normalizeTime(active.mulai_masuk) ||
      normalizeTime(active.mulaiMasuk) ||
      normalizeTime(active.start_time) ||
      normalizeTime(active.startTime);
    const selesaiMasuk =
      normalizeTime(active.selesai_masuk) ||
      normalizeTime(active.selesaiMasuk) ||
      normalizeTime(active.end_time) ||
      normalizeTime(active.endTime);
    const mulaiPulang =
      normalizeTime(active.mulai_pulang) ||
      normalizeTime(active.mulaiPulang) ||
      normalizeTime(active.start_checkout) ||
      normalizeTime(active.startCheckout);
    const selesaiPulang =
      normalizeTime(active.selesai_pulang) ||
      normalizeTime(active.selesaiPulang) ||
      normalizeTime(active.end_checkout) ||
      normalizeTime(active.endCheckout);

    if (!mulaiMasuk || !selesaiMasuk) return null;

    const kompensasi =
      active.kompensasi_waktu ??
      active.kompensasiWaktu ??
      active.grace_period_minutes ??
      active.gracePeriodMinutes ??
      15;

    return {
      mulaiMasuk,
      selesaiMasuk,
      mulaiPulang: mulaiPulang ?? "15:30",
      selesaiPulang: selesaiPulang ?? "17:00",
      kompensasiWaktu: kompensasi,
    };
  };

  // Indonesian projection keys with seconds
  const indonesianSchedule: TestAstraSchedule[] = [
    {
      day_of_week: "senin",
      mulai_masuk: "06:30:00",
      selesai_masuk: "07:15:00",
      mulai_pulang: "15:30:00",
      selesai_pulang: "17:00:00",
      kompensasi_waktu: 20,
      is_active: true,
    },
  ];
  const parsedId = parseSchedule(indonesianSchedule, "senin");
  assert.ok(parsedId);
  assert.equal(parsedId.mulaiMasuk, "06:30");
  assert.equal(parsedId.selesaiMasuk, "07:15");
  assert.equal(parsedId.mulaiPulang, "15:30");
  assert.equal(parsedId.selesaiPulang, "17:00");
  assert.equal(parsedId.kompensasiWaktu, 20);

  // English projection keys with seconds
  const englishSchedule: TestAstraSchedule[] = [
    {
      day_of_week: "senin",
      start_time: "06:45:00",
      end_time: "07:30:00",
      start_checkout: "16:00:00",
      end_checkout: "17:30:00",
      grace_period_minutes: 10,
      is_active: true,
    },
  ];
  const parsedEn = parseSchedule(englishSchedule, "senin");
  assert.ok(parsedEn);
  assert.equal(parsedEn.mulaiMasuk, "06:45");
  assert.equal(parsedEn.selesaiMasuk, "07:30");
  assert.equal(parsedEn.mulaiPulang, "16:00");
  assert.equal(parsedEn.selesaiPulang, "17:30");
  assert.equal(parsedEn.kompensasiWaktu, 10);

  // Inactive schedule returns null
  const inactiveSchedule: TestAstraSchedule[] = [
    {
      day_of_week: "senin",
      mulai_masuk: "06:30",
      selesai_masuk: "07:15",
      is_active: false,
    },
  ];
  assert.equal(parseSchedule(inactiveSchedule, "senin"), null);

  // Non-matching day returns null
  assert.equal(parseSchedule(indonesianSchedule, "selasa"), null);
});

test("Challenge 12: Comprehensive Boundary Minutes & All 6 Time Windows Evaluation", () => {
  const toMinutes = (t: string) => {
    const [h, m] = t.split(":").map(Number);
    return (h ?? 0) * 60 + (m ?? 0);
  };

  const evaluateTimeWindow = (
    minuteOfDay: number,
    s: {
      mulaiMasuk: string;
      selesaiMasuk: string;
      mulaiPulang: string;
      selesaiPulang: string;
      kompensasiWaktu: number;
    },
  ) => {
    const mins = minuteOfDay;
    const masukStart = toMinutes(s.mulaiMasuk);
    const masukEnd = toMinutes(s.selesaiMasuk);
    const masukLate = masukEnd + s.kompensasiWaktu;
    const pulangStart = toMinutes(s.mulaiPulang);
    const pulangEnd = toMinutes(s.selesaiPulang);

    if (mins < masukStart) {
      return "before_check_in";
    }
    if (mins <= masukEnd) {
      return "check_in";
    }
    if (mins <= masukLate) {
      return "late";
    }
    if (mins < pulangStart) {
      return "between_windows";
    }
    if (mins <= pulangEnd) {
      return "check_out";
    }
    return "after_check_out";
  };

  // Case 1: Standard Weekday (Mon-Thu: 06:30 - 07:15, Grace: 15m, Pulang: 15:30 - 17:00)
  const standardSched = {
    mulaiMasuk: "06:30",
    selesaiMasuk: "07:15",
    mulaiPulang: "15:30",
    selesaiPulang: "17:00",
    kompensasiWaktu: 15,
  };

  // Boundary minutes testing
  assert.equal(evaluateTimeWindow(0, standardSched), "before_check_in"); // 00:00
  assert.equal(evaluateTimeWindow(389, standardSched), "before_check_in"); // 06:29
  assert.equal(evaluateTimeWindow(390, standardSched), "check_in"); // 06:30 (Exact start)
  assert.equal(evaluateTimeWindow(420, standardSched), "check_in"); // 07:00 (Mid check-in)
  assert.equal(evaluateTimeWindow(435, standardSched), "check_in"); // 07:15 (Exact end)
  assert.equal(evaluateTimeWindow(436, standardSched), "late"); // 07:16 (First late min)
  assert.equal(evaluateTimeWindow(450, standardSched), "late"); // 07:30 (Exact grace threshold 07:15 + 15)
  assert.equal(evaluateTimeWindow(451, standardSched), "between_windows"); // 07:31 (Window closed)
  assert.equal(evaluateTimeWindow(720, standardSched), "between_windows"); // 12:00 (Noon)
  assert.equal(evaluateTimeWindow(929, standardSched), "between_windows"); // 15:29 (Pre-checkout)
  assert.equal(evaluateTimeWindow(930, standardSched), "check_out"); // 15:30 (Checkout opens)
  assert.equal(evaluateTimeWindow(990, standardSched), "check_out"); // 16:30 (Mid checkout)
  assert.equal(evaluateTimeWindow(1020, standardSched), "check_out"); // 17:00 (Checkout closes)
  assert.equal(evaluateTimeWindow(1021, standardSched), "after_check_out"); // 17:01 (After checkout)
  assert.equal(evaluateTimeWindow(1439, standardSched), "after_check_out"); // 23:59 (End of day)

  // Full 1440-minute sweep for standard schedule
  for (let m = 0; m < 1440; m++) {
    const res = evaluateTimeWindow(m, standardSched);
    if (m < 390) assert.equal(res, "before_check_in");
    else if (m <= 435) assert.equal(res, "check_in");
    else if (m <= 450) assert.equal(res, "late");
    else if (m < 930) assert.equal(res, "between_windows");
    else if (m <= 1020) assert.equal(res, "check_out");
    else assert.equal(res, "after_check_out");
  }

  // Case 2: Friday Schedule (06:30 - 07:00, Grace: 15m, Pulang: 11:30 - 13:00)
  const fridaySched = {
    mulaiMasuk: "06:30",
    selesaiMasuk: "07:00",
    mulaiPulang: "11:30",
    selesaiPulang: "13:00",
    kompensasiWaktu: 15,
  };
  assert.equal(evaluateTimeWindow(389, fridaySched), "before_check_in"); // 06:29
  assert.equal(evaluateTimeWindow(390, fridaySched), "check_in"); // 06:30
  assert.equal(evaluateTimeWindow(420, fridaySched), "check_in"); // 07:00
  assert.equal(evaluateTimeWindow(421, fridaySched), "late"); // 07:01
  assert.equal(evaluateTimeWindow(435, fridaySched), "late"); // 07:15
  assert.equal(evaluateTimeWindow(436, fridaySched), "between_windows"); // 07:16
  assert.equal(evaluateTimeWindow(689, fridaySched), "between_windows"); // 11:29
  assert.equal(evaluateTimeWindow(690, fridaySched), "check_out"); // 11:30
  assert.equal(evaluateTimeWindow(780, fridaySched), "check_out"); // 13:00
  assert.equal(evaluateTimeWindow(781, fridaySched), "after_check_out"); // 13:01

  // Case 3: Zero Grace Period (kompensasiWaktu = 0)
  const zeroGraceSched = {
    mulaiMasuk: "07:00",
    selesaiMasuk: "08:00",
    mulaiPulang: "16:00",
    selesaiPulang: "17:00",
    kompensasiWaktu: 0,
  };
  assert.equal(evaluateTimeWindow(480, zeroGraceSched), "check_in"); // 08:00
  assert.equal(evaluateTimeWindow(481, zeroGraceSched), "between_windows"); // 08:01 immediately moves to between_windows

  // Case 4: Midnight-Starting Schedule (00:00 - 05:00, Grace: 30m, Pulang: 20:00 - 23:59)
  const midnightSched = {
    mulaiMasuk: "00:00",
    selesaiMasuk: "05:00",
    mulaiPulang: "20:00",
    selesaiPulang: "23:59",
    kompensasiWaktu: 30,
  };
  assert.equal(evaluateTimeWindow(0, midnightSched), "check_in"); // 00:00 opens directly
  assert.equal(evaluateTimeWindow(300, midnightSched), "check_in"); // 05:00
  assert.equal(evaluateTimeWindow(301, midnightSched), "late"); // 05:01
  assert.equal(evaluateTimeWindow(330, midnightSched), "late"); // 05:30
  assert.equal(evaluateTimeWindow(331, midnightSched), "between_windows"); // 05:31
  assert.equal(evaluateTimeWindow(1199, midnightSched), "between_windows"); // 19:59
  assert.equal(evaluateTimeWindow(1200, midnightSched), "check_out"); // 20:00
  assert.equal(evaluateTimeWindow(1439, midnightSched), "check_out"); // 23:59 stays open until day ends
});

test("Challenge 13: Exhaustive Key Fallback & Projection Matrix", () => {
  interface MultiKeySchedule {
    id?: string;
    day_of_week?: string;
    hari?: string;
    start_time?: string;
    startTime?: string;
    end_time?: string;
    endTime?: string;
    start_checkout?: string;
    startCheckout?: string;
    end_checkout?: string;
    endCheckout?: string;
    mulai_masuk?: string | null;
    mulaiMasuk?: string | null;
    selesai_masuk?: string | null;
    selesaiMasuk?: string | null;
    mulai_pulang?: string | null;
    mulaiPulang?: string | null;
    selesai_pulang?: string | null;
    selesaiPulang?: string | null;
    kompensasi_waktu?: number | null;
    kompensasiWaktu?: number | null;
    grace_period_minutes?: number | null;
    gracePeriodMinutes?: number | null;
    is_active?: boolean;
    isActive?: boolean;
  }

  const parseScheduleMatrix = (schedules: MultiKeySchedule[], day: string) => {
    const active = schedules.find(
      (s) =>
        (s.day_of_week === day || s.hari === day) &&
        s.is_active !== false &&
        s.isActive !== false,
    );
    if (!active) return null;

    const normalizeTime = (t?: string | null) => (t ? t.slice(0, 5) : null);

    const mulaiMasuk =
      normalizeTime(active.mulai_masuk) ||
      normalizeTime(active.mulaiMasuk) ||
      normalizeTime(active.start_time) ||
      normalizeTime(active.startTime);
    const selesaiMasuk =
      normalizeTime(active.selesai_masuk) ||
      normalizeTime(active.selesaiMasuk) ||
      normalizeTime(active.end_time) ||
      normalizeTime(active.endTime);
    const mulaiPulang =
      normalizeTime(active.mulai_pulang) ||
      normalizeTime(active.mulaiPulang) ||
      normalizeTime(active.start_checkout) ||
      normalizeTime(active.startCheckout);
    const selesaiPulang =
      normalizeTime(active.selesai_pulang) ||
      normalizeTime(active.selesaiPulang) ||
      normalizeTime(active.end_checkout) ||
      normalizeTime(active.endCheckout);

    if (!mulaiMasuk || !selesaiMasuk) return null;

    const kompensasi =
      active.kompensasi_waktu ??
      active.kompensasiWaktu ??
      active.grace_period_minutes ??
      active.gracePeriodMinutes ??
      15;

    return {
      mulaiMasuk,
      selesaiMasuk,
      mulaiPulang: mulaiPulang ?? "15:30",
      selesaiPulang: selesaiPulang ?? "17:00",
      kompensasiWaktu: kompensasi,
    };
  };

  // 1. Indonesian snake_case
  const p1 = parseScheduleMatrix(
    [
      {
        day_of_week: "rabu",
        mulai_masuk: "06:30:00",
        selesai_masuk: "07:15:00",
        mulai_pulang: "15:30:00",
        selesai_pulang: "17:00:00",
        kompensasi_waktu: 25,
        is_active: true,
      },
    ],
    "rabu",
  );
  assert.deepEqual(p1, {
    mulaiMasuk: "06:30",
    selesaiMasuk: "07:15",
    mulaiPulang: "15:30",
    selesaiPulang: "17:00",
    kompensasiWaktu: 25,
  });

  // 2. Indonesian camelCase
  const p2 = parseScheduleMatrix(
    [
      {
        hari: "kamis",
        mulaiMasuk: "06:45",
        selesaiMasuk: "07:30",
        mulaiPulang: "16:00",
        selesaiPulang: "17:30",
        kompensasiWaktu: 30,
        isActive: true,
      },
    ],
    "kamis",
  );
  assert.deepEqual(p2, {
    mulaiMasuk: "06:45",
    selesaiMasuk: "07:30",
    mulaiPulang: "16:00",
    selesaiPulang: "17:30",
    kompensasiWaktu: 30,
  });

  // 3. English snake_case
  const p3 = parseScheduleMatrix(
    [
      {
        day_of_week: "jumat",
        start_time: "06:30:00",
        end_time: "07:00:00",
        start_checkout: "11:30:00",
        end_checkout: "13:00:00",
        grace_period_minutes: 10,
        is_active: true,
      },
    ],
    "jumat",
  );
  assert.deepEqual(p3, {
    mulaiMasuk: "06:30",
    selesaiMasuk: "07:00",
    mulaiPulang: "11:30",
    selesaiPulang: "13:00",
    kompensasiWaktu: 10,
  });

  // 4. English camelCase
  const p4 = parseScheduleMatrix(
    [
      {
        day_of_week: "sabtu",
        startTime: "06:00",
        endTime: "23:59",
        startCheckout: "11:00",
        endCheckout: "23:59",
        gracePeriodMinutes: 60,
        isActive: true,
      },
    ],
    "sabtu",
  );
  assert.deepEqual(p4, {
    mulaiMasuk: "06:00",
    selesaiMasuk: "23:59",
    mulaiPulang: "11:00",
    selesaiPulang: "23:59",
    kompensasiWaktu: 60,
  });

  // 5. Hybrid / Mixed keys
  const p5 = parseScheduleMatrix(
    [
      {
        hari: "senin",
        start_time: "06:20",
        selesaiMasuk: "07:10",
        startCheckout: "15:00",
        selesai_pulang: "16:30",
        grace_period_minutes: 12,
        is_active: true,
      },
    ],
    "senin",
  );
  assert.deepEqual(p5, {
    mulaiMasuk: "06:20",
    selesaiMasuk: "07:10",
    mulaiPulang: "15:00",
    selesaiPulang: "16:30",
    kompensasiWaktu: 12,
  });

  // 6. Default fallbacks when checkout or grace are omitted
  const p6 = parseScheduleMatrix(
    [
      {
        day_of_week: "senin",
        mulai_masuk: "06:30",
        selesai_masuk: "07:15",
        is_active: true,
      },
    ],
    "senin",
  );
  assert.deepEqual(p6, {
    mulaiMasuk: "06:30",
    selesaiMasuk: "07:15",
    mulaiPulang: "15:30", // Default
    selesaiPulang: "17:00", // Default
    kompensasiWaktu: 15, // Default
  });

  // 7. Missing check-in times returns null
  assert.equal(
    parseScheduleMatrix(
      [
        {
          day_of_week: "senin",
          mulai_pulang: "15:30",
          selesai_pulang: "17:00",
          is_active: true,
        },
      ],
      "senin",
    ),
    null,
  );

  // 8. Inactive schedule returns null
  assert.equal(
    parseScheduleMatrix(
      [
        {
          day_of_week: "senin",
          mulai_masuk: "06:30",
          selesai_masuk: "07:15",
          is_active: true,
          isActive: false, // Explicitly false in one of the fields
        },
      ],
      "senin",
    ),
    null,
  );
});
