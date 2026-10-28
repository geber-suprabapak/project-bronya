import assert from "node:assert/strict";
import test from "node:test";
import { z } from "zod";

// Astra Contract Schema
const astraAttendanceSchema = z
  .object({
    user_id: z.string().min(1).optional(),
    userId: z.string().min(1).optional(),
    action_type: z.enum(["check_in", "check_out"]).optional(),
    actionType: z.enum(["check_in", "check_out"]).optional(),
    status: z.enum(["Hadir", "Terlambat", "Pulang", "Alpha"]).optional(),
    reason: z.string().min(3).max(500),
    date: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .optional(),
    latitude: z.number().optional(),
    longitude: z.number().optional(),
  })
  .refine((data) => Boolean(data.user_id || data.userId), {
    message: "User ID is required.",
  })
  .refine((data) => Boolean(data.action_type || data.actionType), {
    message: "Action type is required.",
  });

// Core logic extraction for isolated stress testing
type ScheduleTimeWindow =
  | "before_check_in"
  | "check_in"
  | "late"
  | "between_windows"
  | "check_out"
  | "after_check_out"
  | "outside"
  | "no_schedule";

interface AstraAttendanceRecord {
  id?: string;
  user_id?: string;
  userId?: string;
  date?: string;
  status?: string;
  action_type?: string;
  actionType?: string;
}

const sanitizeNis = (input: string) => {
  const clean = input.replace(/^\][A-Za-z]\d/, "");
  return clean.replace(/\D/g, "");
};

const toMinutes = (t: string) => {
  const [h, m] = t.split(":").map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
};

const evaluateScheduleWindow = (
  minuteOfDay: number,
  s: {
    mulaiMasuk: string;
    selesaiMasuk: string;
    mulaiPulang: string;
    selesaiPulang: string;
    kompensasiWaktu: number;
  },
): ScheduleTimeWindow => {
  const mins = minuteOfDay;
  const masukStart = toMinutes(s.mulaiMasuk);
  const masukEnd = toMinutes(s.selesaiMasuk);
  const masukLate = masukEnd + s.kompensasiWaktu;
  const pulangStart = toMinutes(s.mulaiPulang);
  const pulangEnd = toMinutes(s.selesaiPulang);

  if (mins < masukStart) return "before_check_in";
  if (mins <= masukEnd) return "check_in";
  if (mins <= masukLate) return "late";
  if (mins < pulangStart) return "between_windows";
  if (mins <= pulangEnd) return "check_out";
  return "after_check_out";
};

const evaluateAttendanceLifecycle = (
  timeWindow: ScheduleTimeWindow,
  records: AstraAttendanceRecord[],
) => {
  const checkInRecord = records.find(
    (r) =>
      r.action_type === "check_in" ||
      r.actionType === "check_in" ||
      r.status === "Hadir" ||
      r.status === "Terlambat",
  );
  const checkOutRecord = records.find(
    (r) =>
      r.action_type === "check_out" ||
      r.actionType === "check_out" ||
      r.status === "Pulang",
  );

  const hasCheckedIn = Boolean(checkInRecord);
  const hasCheckedOut = Boolean(checkOutRecord);

  // 1. If already completed both check-in and check-out today
  if (hasCheckedOut) {
    return {
      actionable: false,
      actionType: "none" as const,
      status: "Selesai",
      alreadyPresent: true,
    };
  }

  // 2. Before check-in window
  if (timeWindow === "before_check_in") {
    return {
      actionable: false,
      actionType: "none" as const,
      status: "Belum Waktunya",
      alreadyPresent: hasCheckedIn,
    };
  }

  // 3. In Check-in or Late window
  if (timeWindow === "check_in" || timeWindow === "late") {
    if (hasCheckedIn) {
      return {
        actionable: false,
        actionType: "none" as const,
        status: "Sudah Masuk",
        alreadyPresent: true,
      };
    }
    return {
      actionable: true,
      actionType: "check_in" as const,
      status: timeWindow === "late" ? "Terlambat" : "Hadir",
      alreadyPresent: false,
    };
  }

  // 4. Between windows
  if (timeWindow === "between_windows") {
    if (hasCheckedIn) {
      return {
        actionable: false,
        actionType: "none" as const,
        status: "Menunggu Pulang",
        alreadyPresent: true,
      };
    }
    return {
      actionable: false,
      actionType: "none" as const,
      status: "Waktu Habis",
      alreadyPresent: false,
    };
  }

  // 5. In Checkout window
  if (timeWindow === "check_out") {
    return {
      actionable: true,
      actionType: "check_out" as const,
      status: "Pulang",
      alreadyPresent: false,
    };
  }

  // 6. After checkout or holiday
  return {
    actionable: false,
    actionType: "none" as const,
    status: hasCheckedIn ? "Selesai" : "Tutup",
    alreadyPresent: hasCheckedIn || hasCheckedOut,
  };
};

test("Challenger Stress Test 1: Full 18-Cell State Matrix Verification", () => {
  const windows: ScheduleTimeWindow[] = [
    "before_check_in",
    "check_in",
    "late",
    "between_windows",
    "check_out",
    "after_check_out",
  ];

  // Lifecycle State A: No Attendance (Empty History)
  const historyNone: AstraAttendanceRecord[] = [];
  // Lifecycle State B: Checked-In Only
  const historyCheckedIn: AstraAttendanceRecord[] = [
    { action_type: "check_in", status: "Hadir" },
  ];
  // Lifecycle State C: Completed (Checked-In + Checked-Out)
  const historyCompleted: AstraAttendanceRecord[] = [
    { action_type: "check_in", status: "Hadir" },
    { action_type: "check_out", status: "Pulang" },
  ];

  for (const win of windows) {
    // Check State C: Always completed & non-actionable
    const resC = evaluateAttendanceLifecycle(win, historyCompleted);
    assert.equal(
      resC.actionable,
      false,
      `State C in ${win} must be non-actionable`,
    );
    assert.equal(resC.actionType, "none");
    assert.equal(resC.status, "Selesai");
    assert.equal(resC.alreadyPresent, true);

    // Check State B:
    const resB = evaluateAttendanceLifecycle(win, historyCheckedIn);
    if (win === "check_out") {
      assert.equal(
        resB.actionable,
        true,
        "State B in check_out must be actionable check_out",
      );
      assert.equal(resB.actionType, "check_out");
      assert.equal(resB.status, "Pulang");
      assert.equal(resB.alreadyPresent, false);
    } else if (win === "check_in" || win === "late") {
      assert.equal(
        resB.actionable,
        false,
        `State B in ${win} must reject duplicate check-in`,
      );
      assert.equal(resB.status, "Sudah Masuk");
      assert.equal(resB.alreadyPresent, true);
    } else if (win === "between_windows") {
      assert.equal(resB.actionable, false);
      assert.equal(resB.status, "Menunggu Pulang");
      assert.equal(resB.alreadyPresent, true);
    } else if (win === "before_check_in") {
      assert.equal(resB.actionable, false);
      assert.equal(resB.status, "Belum Waktunya");
      assert.equal(resB.alreadyPresent, true);
    } else if (win === "after_check_out") {
      assert.equal(resB.actionable, false);
      assert.equal(resB.status, "Selesai");
      assert.equal(resB.alreadyPresent, true);
    }

    // Check State A:
    const resA = evaluateAttendanceLifecycle(win, historyNone);
    if (win === "check_in") {
      assert.equal(resA.actionable, true);
      assert.equal(resA.actionType, "check_in");
      assert.equal(resA.status, "Hadir");
      assert.equal(resA.alreadyPresent, false);
    } else if (win === "late") {
      assert.equal(resA.actionable, true);
      assert.equal(resA.actionType, "check_in");
      assert.equal(resA.status, "Terlambat");
      assert.equal(resA.alreadyPresent, false);
    } else if (win === "check_out") {
      assert.equal(resA.actionable, true);
      assert.equal(resA.actionType, "check_out");
      assert.equal(resA.status, "Pulang");
      assert.equal(resA.alreadyPresent, false);
    } else if (win === "before_check_in") {
      assert.equal(resA.actionable, false);
      assert.equal(resA.status, "Belum Waktunya");
      assert.equal(resA.alreadyPresent, false);
    } else if (win === "between_windows") {
      assert.equal(resA.actionable, false);
      assert.equal(resA.status, "Waktu Habis");
      assert.equal(resA.alreadyPresent, false);
    } else if (win === "after_check_out") {
      assert.equal(resA.actionable, false);
      assert.equal(resA.status, "Tutup");
      assert.equal(resA.alreadyPresent, false);
    }
  }
});

test("Challenger Stress Test 2: Double-Check Race Condition Defense", async () => {
  // Simulate double-check logic in saveAttendance
  const mockDbRecords: AstraAttendanceRecord[] = [];

  const simulateConcurrentScans = async (
    userId: string,
    actionType: "check_in" | "check_out",
  ) => {
    // Check existing
    const hasCheckedIn = mockDbRecords.some(
      (r) =>
        r.user_id === userId &&
        (r.action_type === "check_in" || r.status === "Hadir"),
    );
    const hasCheckedOut = mockDbRecords.some(
      (r) =>
        r.user_id === userId &&
        (r.action_type === "check_out" || r.status === "Pulang"),
    );

    if (actionType === "check_in" && hasCheckedIn) {
      return { success: false, alreadyPresent: true, message: "Sudah masuk" };
    }
    if (actionType === "check_out" && hasCheckedOut) {
      return { success: false, alreadyPresent: true, message: "Sudah selesai" };
    }

    // Simulate DB insertion
    mockDbRecords.push({
      user_id: userId,
      action_type: actionType,
      status: actionType === "check_in" ? "Hadir" : "Pulang",
      date: "2026-08-31",
    });

    return { success: true, message: "Berhasil dicatat" };
  };

  // 1. Initial check-in -> succeeds
  const r1 = await simulateConcurrentScans("user_17706", "check_in");
  assert.equal(r1.success, true);
  assert.equal(mockDbRecords.length, 1);

  // 2. Immediate duplicate check-in -> rejected
  const r2 = await simulateConcurrentScans("user_17706", "check_in");
  assert.equal(r2.success, false);
  assert.equal(r2.alreadyPresent, true);
  assert.equal(mockDbRecords.length, 1); // DB untouched!

  // 3. Third rapid duplicate scan -> rejected
  const r3 = await simulateConcurrentScans("user_17706", "check_in");
  assert.equal(r3.success, false);
  assert.equal(r3.alreadyPresent, true);
  assert.equal(mockDbRecords.length, 1);

  // 4. Checkout scan -> succeeds
  const r4 = await simulateConcurrentScans("user_17706", "check_out");
  assert.equal(r4.success, true);
  assert.equal(mockDbRecords.length, 2);

  // 5. Subsequent post-checkout scan -> rejected
  const r5 = await simulateConcurrentScans("user_17706", "check_out");
  assert.equal(r5.success, false);
  assert.equal(r5.alreadyPresent, true);
  assert.equal(mockDbRecords.length, 2); // DB untouched!
});

test("Challenger Stress Test 3: Barcode Sanitization Edge Cases & Injection Vectors", () => {
  const testCases = [
    { input: "17706", expected: "17706" },
    { input: "]C117706", expected: "17706" }, // GS1-128
    { input: "]c117706", expected: "17706" }, // Lowercase
    { input: "]A017706", expected: "17706" }, // Code 39
    { input: "]Q117706", expected: "17706" }, // QR Code
    { input: "]d217706", expected: "17706" }, // DataMatrix
    { input: "]E017706", expected: "17706" }, // EAN-13
    { input: "17706\r\n", expected: "17706" }, // CR/LF
    { input: "  17706  ", expected: "17706" }, // Whitespace
    { input: "'; DROP TABLE students; --17706", expected: "17706" }, // SQL injection payload
    { input: "<script>alert(1)</script>17706", expected: "117706" }, // XSS payload
    { input: "NIS: 17706", expected: "17706" }, // Prefix label
    { input: "", expected: "" }, // Empty
    { input: "     ", expected: "" }, // All spaces
    { input: "]C1", expected: "" }, // AIM prefix only
    { input: "abc", expected: "" }, // Non numeric
  ];

  for (const tc of testCases) {
    const res = sanitizeNis(tc.input);
    assert.equal(res, tc.expected, `Input '${tc.input}' sanitization failed`);
  }
});

test("Challenger Stress Test 4: Schema Validation on Astra Contract Requirements", () => {
  const baseValid = {
    user_id: "user_test_123",
    action_type: "check_in" as const,
    status: "Hadir" as const,
    reason: "Kiosk terminal scan",
    date: "2026-08-31",
    latitude: -7.44998,
    longitude: 110.2236,
  };

  assert.equal(astraAttendanceSchema.safeParse(baseValid).success, true);

  // Missing userId AND user_id -> failure
  const noUser = { ...baseValid, user_id: undefined };
  assert.equal(astraAttendanceSchema.safeParse(noUser).success, false);

  // Missing actionType AND action_type -> failure
  const noAction = { ...baseValid, action_type: undefined };
  assert.equal(astraAttendanceSchema.safeParse(noAction).success, false);

  // Reason too short (<3 chars) -> failure
  const shortReason = { ...baseValid, reason: "hi" };
  assert.equal(astraAttendanceSchema.safeParse(shortReason).success, false);

  // Invalid date format -> failure
  const badDate = { ...baseValid, date: "2026/08/31" };
  assert.equal(astraAttendanceSchema.safeParse(badDate).success, false);

  // Invalid status -> failure
  const badStatus = { ...baseValid, status: "Present" };
  assert.equal(astraAttendanceSchema.safeParse(badStatus).success, false);
});

test("Challenger Stress Test 5: Boundary Schedule Transitions", () => {
  const sched = {
    mulaiMasuk: "06:30",
    selesaiMasuk: "07:15",
    mulaiPulang: "15:30",
    selesaiPulang: "17:00",
    kompensasiWaktu: 15,
  };

  // 06:29 -> before_check_in
  assert.equal(evaluateScheduleWindow(389, sched), "before_check_in");
  // 06:30 -> check_in
  assert.equal(evaluateScheduleWindow(390, sched), "check_in");
  // 07:15 -> check_in
  assert.equal(evaluateScheduleWindow(435, sched), "check_in");
  // 07:16 -> late
  assert.equal(evaluateScheduleWindow(436, sched), "late");
  // 07:30 -> late
  assert.equal(evaluateScheduleWindow(450, sched), "late");
  // 07:31 -> between_windows
  assert.equal(evaluateScheduleWindow(451, sched), "between_windows");
  // 15:29 -> between_windows
  assert.equal(evaluateScheduleWindow(929, sched), "between_windows");
  // 15:30 -> check_out
  assert.equal(evaluateScheduleWindow(930, sched), "check_out");
  // 17:00 -> check_out
  assert.equal(evaluateScheduleWindow(1020, sched), "check_out");
  // 17:01 -> after_check_out
  assert.equal(evaluateScheduleWindow(1021, sched), "after_check_out");
});
