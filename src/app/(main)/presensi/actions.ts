"use server";

import { getAccessToken } from "@logto/next/server-actions";
import { z } from "zod";
import { env } from "~/env";
import { logtoConfig } from "~/lib/logto/config";

type AbsenceData = {
  userName: string;
  nis: string;
  className: string;
  status: string;
  date: string;
  actionType: "check_in" | "check_out" | "none";
  actionable: boolean;
};

export type AbsenceResult = {
  success: boolean;
  message: string;
  alreadyPresent?: boolean;
  data?: AbsenceData;
};

const formatDisplayDate = (date: Date) =>
  date.toLocaleDateString("id-ID", {
    timeZone: "Asia/Jakarta",
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

const sanitizeNis = (input: string) => {
  // Remove common barcode AIM identifiers (e.g., ]C1 for Code 128)
  const clean = input.replace(/^\][A-Za-z]\d/, "");
  // Remove all non-numeric characters
  return clean.replace(/\D/g, "");
};

const getWibDateStr = (date: Date = new Date()) => {
  const wib = new Date(
    date.toLocaleString("en-US", { timeZone: "Asia/Jakarta" }),
  );
  const y = wib.getFullYear();
  const m = String(wib.getMonth() + 1).padStart(2, "0");
  const d = String(wib.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
};

export type ScheduleTimeWindow =
  | "before_check_in"
  | "check_in"
  | "late"
  | "between_windows"
  | "check_out"
  | "after_check_out"
  | "outside"
  | "no_schedule";

type ScheduleConfig = {
  mulaiMasuk: string;
  selesaiMasuk: string;
  mulaiPulang: string;
  selesaiPulang: string;
  kompensasiWaktu: number;
};

export type ScheduleStatus = {
  success: boolean;
  timeWindow: ScheduleTimeWindow;
  message: string;
  schedule?: ScheduleConfig & { hari: string };
};

const DAYS_ID = [
  "minggu",
  "senin",
  "selasa",
  "rabu",
  "kamis",
  "jumat",
  "sabtu",
] as const;

type DefaultScheduleDay = Exclude<(typeof DAYS_ID)[number], "minggu">;

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
  rabu: {
    mulaiMasuk: "06:30",
    selesaiMasuk: "07:15",
    mulaiPulang: "15:30",
    selesaiPulang: "17:00",
    kompensasiWaktu: 15,
  },
  kamis: {
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
} satisfies Record<DefaultScheduleDay, ScheduleConfig>;

const toMinutes = (t: string) => {
  const [h, m] = t.split(":").map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
};

const optionalText = z.string().nullish();
const AstraStudentSchema = z
  .object({
    id: optionalText,
    user_id: optionalText,
    userId: optionalText,
    nis: optionalText,
    full_name: optionalText,
    fullName: optionalText,
    class_name: optionalText,
    className: optionalText,
    avatar_url: optionalText,
    avatarUrl: optionalText,
    email: optionalText,
    absence_number: optionalText,
    absenceNumber: optionalText,
    gender: optionalText,
    role: optionalText,
    lifecycle_status: optionalText,
  })
  .passthrough();
const AstraAttendanceSchema = z
  .object({
    id: optionalText,
    user_id: optionalText,
    userId: optionalText,
    date: optionalText,
    status: optionalText,
    action_type: optionalText,
    actionType: optionalText,
    created_at: optionalText,
  })
  .passthrough();
const AstraScheduleSchema = z
  .object({
    id: optionalText,
    day_of_week: optionalText,
    hari: optionalText,
    start_time: optionalText,
    startTime: optionalText,
    end_time: optionalText,
    endTime: optionalText,
    start_checkout: optionalText,
    startCheckout: optionalText,
    end_checkout: optionalText,
    endCheckout: optionalText,
    mulai_masuk: optionalText,
    mulaiMasuk: optionalText,
    selesai_masuk: optionalText,
    selesaiMasuk: optionalText,
    mulai_pulang: optionalText,
    mulaiPulang: optionalText,
    selesai_pulang: optionalText,
    selesaiPulang: optionalText,
    kompensasi_waktu: z.number().nullish(),
    kompensasiWaktu: z.number().nullish(),
    grace_period_minutes: z.number().nullish(),
    gracePeriodMinutes: z.number().nullish(),
    is_active: z.boolean().nullish(),
    isActive: z.boolean().nullish(),
  })
  .passthrough();
const AstraStudentsResponseSchema = z.union([
  z.object({ data: z.array(AstraStudentSchema) }).passthrough(),
  z.array(AstraStudentSchema),
]);
const AstraAttendanceResponseSchema = z.union([
  z.object({ data: z.array(AstraAttendanceSchema) }).passthrough(),
  z.array(AstraAttendanceSchema),
]);
const AstraSchedulesResponseSchema = z.union([
  z.object({ data: z.array(AstraScheduleSchema) }).passthrough(),
  z.array(AstraScheduleSchema),
]);
type AstraAttendance = z.infer<typeof AstraAttendanceSchema>;
type StudentAttendanceHistory =
  | {
      available: true;
      hasCheckedIn: boolean;
      hasCheckedOut: boolean;
      checkInRecord?: AstraAttendance;
      checkOutRecord?: AstraAttendance;
    }
  | { available: false; hasCheckedIn: false; hasCheckedOut: false };

const ATTENDANCE_HISTORY_UNAVAILABLE: StudentAttendanceHistory = {
  available: false,
  hasCheckedIn: false,
  hasCheckedOut: false,
};
const ATTENDANCE_HISTORY_ERROR =
  "Tidak dapat memeriksa riwayat presensi. Silakan coba lagi.";

const astraApiUrl = (): string => {
  if (!env.ASTRA_API_URL) {
    throw new Error("Astra API URL is not configured");
  }

  return env.ASTRA_API_URL;
};

const getAstraTokenDiagnostics = (headers: Record<string, string>) => {
  const token = headers.Authorization?.replace(/^Bearer\s+/, "");
  const payloadSegment = token?.split(".")[1];

  if (!payloadSegment) {
    return { format: "not-a-jwt" };
  }

  try {
    const parsedPayload = z
      .object({
        iss: z.string().optional(),
        aud: z.union([z.string(), z.array(z.string())]).optional(),
        scope: z.string().optional(),
        exp: z.number().optional(),
      })
      .passthrough()
      .safeParse(
        JSON.parse(Buffer.from(payloadSegment, "base64url").toString("utf8")),
      );
    if (!parsedPayload.success) return { format: "malformed-jwt" };

    const payload = parsedPayload.data;
    const audience = Array.isArray(payload.aud)
      ? payload.aud
      : payload.aud
        ? [payload.aud]
        : [];
    const scopes = payload.scope?.split(" ").filter(Boolean) ?? [];

    return {
      format: "jwt",
      issuer: payload.iss ?? null,
      audience,
      scopes,
      expired: payload.exp == null ? null : payload.exp <= Date.now() / 1000,
    };
  } catch {
    return { format: "malformed-jwt" };
  }
};

const astraHeaders = async (): Promise<Record<string, string>> => {
  // Astra must receive the access token for the currently authenticated Logto
  // operator. A static device token would outlive or outlast the operator's
  // session and could not enforce the user's current Astra scopes.
  const accessToken = await getAccessToken(logtoConfig, env.LOGTO_RESOURCE);
  return {
    Authorization: `Bearer ${accessToken}`,
    "Content-Type": "application/json",
    "X-Astra-Contract-Version": "v1",
  };
};

const findUserByNis = async (nis: string) => {
  const cleanNis = sanitizeNis(nis);
  const headers = await astraHeaders();
  const res = await fetch(`${astraApiUrl()}/v1/admin/students`, {
    headers,
    signal: AbortSignal.timeout(3000),
  });
  if (!res.ok) {
    if (res.status === 401) {
      console.warn(
        "Astra rejected the Logto access token",
        getAstraTokenDiagnostics(headers),
      );
    }
    throw new Error(`Astra student lookup failed with HTTP ${res.status}`);
  }

  const parsed = AstraStudentsResponseSchema.safeParse(await res.json());
  if (!parsed.success) {
    throw new Error("Astra returned an invalid student response");
  }
  const students = Array.isArray(parsed.data) ? parsed.data : parsed.data.data;

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
    createdAt: new Date(),
    updatedAt: new Date(),
  };
};

const getStudentAttendanceToday = async (
  userId: string,
  dateStr: string,
): Promise<StudentAttendanceHistory> => {
  try {
    const headers = await astraHeaders();
    const res = await fetch(
      `${astraApiUrl()}/v1/admin/attendance?userId=${encodeURIComponent(userId)}&date=${encodeURIComponent(dateStr)}`,
      {
        headers,
        signal: AbortSignal.timeout(3000),
      },
    );
    if (!res.ok) return ATTENDANCE_HISTORY_UNAVAILABLE;
    const parsed = AstraAttendanceResponseSchema.safeParse(await res.json());
    if (!parsed.success) {
      throw new Error("Astra returned an invalid attendance response");
    }
    const records = Array.isArray(parsed.data) ? parsed.data : parsed.data.data;

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

    return {
      available: true,
      hasCheckedIn: Boolean(checkInRecord),
      hasCheckedOut: Boolean(checkOutRecord),
      checkInRecord,
      checkOutRecord,
    };
  } catch (error) {
    console.error("Error fetching student attendance history:", error);
    return ATTENDANCE_HISTORY_UNAVAILABLE;
  }
};

const fetchActiveScheduleFromAstra = async (
  day: string,
): Promise<ScheduleConfig | null> => {
  try {
    const headers = await astraHeaders();
    const res = await fetch(
      `${astraApiUrl()}/v1/admin/schedules?day_of_week=${encodeURIComponent(day)}&is_active=true`,
      {
        headers,
        signal: AbortSignal.timeout(3000),
      },
    );
    if (!res.ok) return null;
    const parsed = AstraSchedulesResponseSchema.safeParse(await res.json());
    if (!parsed.success) return null;
    const schedules = Array.isArray(parsed.data)
      ? parsed.data
      : parsed.data.data;
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
  } catch {
    return null;
  }
};

export async function checkScheduleStatus(): Promise<ScheduleStatus> {
  try {
    const now = new Date();
    const wib = new Date(
      now.toLocaleString("en-US", { timeZone: "Asia/Jakarta" }),
    );
    const day = DAYS_ID[wib.getDay()];
    if (!day) {
      return {
        success: true,
        timeWindow: "no_schedule",
        message: "Tidak ada jadwal presensi di hari libur",
      };
    }

    const astraSched = await fetchActiveScheduleFromAstra(day);
    const schedDef = astraSched ??
      (day === "minggu" ? undefined : DEFAULT_SCHEDULES[day]) ?? {
        mulaiMasuk: "06:30",
        selesaiMasuk: "07:15",
        mulaiPulang: "15:30",
        selesaiPulang: "17:00",
        kompensasiWaktu: 15,
      };

    const s = {
      hari: day,
      mulaiMasuk: schedDef.mulaiMasuk,
      selesaiMasuk: schedDef.selesaiMasuk,
      mulaiPulang: schedDef.mulaiPulang,
      selesaiPulang: schedDef.selesaiPulang,
      kompensasiWaktu: schedDef.kompensasiWaktu,
    };

    const mins = wib.getHours() * 60 + wib.getMinutes();
    const masukStart = toMinutes(s.mulaiMasuk);
    const masukEnd = toMinutes(s.selesaiMasuk);
    const masukLate = masukEnd + s.kompensasiWaktu;
    const pulangStart = toMinutes(s.mulaiPulang);
    const pulangEnd = toMinutes(s.selesaiPulang);

    let tw: ScheduleTimeWindow;
    let msg: string;

    if (mins < masukStart) {
      tw = "before_check_in";
      msg = `Belum masuk waktu presensi masuk (dibuka pukul ${s.mulaiMasuk})`;
    } else if (mins <= masukEnd) {
      tw = "check_in";
      msg = "Waktu presensi masuk";
    } else if (mins <= masukLate) {
      tw = "late";
      msg = "Terlambat (masa kompensasi)";
    } else if (mins < pulangStart) {
      tw = "between_windows";
      msg = `Waktu presensi masuk telah habis. Presensi pulang dibuka pukul ${s.mulaiPulang}`;
    } else if (mins <= pulangEnd) {
      tw = "check_out";
      msg = "Waktu presensi pulang";
    } else {
      tw = "after_check_out";
      msg = "Waktu presensi hari ini telah berakhir";
    }

    return { success: true, timeWindow: tw, message: msg, schedule: s };
  } catch {
    return {
      success: false,
      timeWindow: "outside",
      message: "Gagal mengecek jadwal",
    };
  }
}

export async function checkAttendanceStatus(
  nis: string,
  _latitude: number,
  _longitude: number,
): Promise<AbsenceResult> {
  try {
    const cleanNis = sanitizeNis(nis);
    const userProfile = await findUserByNis(cleanNis);

    if (!userProfile) {
      return {
        success: false,
        message: `NIS "${nis}" tidak ditemukan dalam sistem`,
      };
    }

    if (!userProfile.userId.trim()) {
      return {
        success: false,
        message: "Akun siswa belum terhubung. Hubungi admin sekolah.",
      };
    }

    const todayStr = getWibDateStr(new Date());
    const [sched, history] = await Promise.all([
      checkScheduleStatus(),
      getStudentAttendanceToday(userProfile.userId, todayStr),
    ]);
    if (!history.available) {
      return { success: false, message: ATTENDANCE_HISTORY_ERROR };
    }

    const displayDate = formatDisplayDate(new Date());
    const { hasCheckedIn, hasCheckedOut } = history;

    // 1. If already completed both check-in and check-out today
    if (hasCheckedOut) {
      return {
        success: true,
        alreadyPresent: true,
        message: `Siswa ${userProfile.fullName} (${cleanNis}) sudah menyelesaikan seluruh presensi hari ini (sudah absen pulang).`,
        data: {
          userName: userProfile.fullName ?? "Unknown",
          nis: userProfile.nis ?? cleanNis,
          className: userProfile.className ?? "-",
          status: "Selesai",
          date: displayDate,
          actionType: "none",
          actionable: false,
        },
      };
    }

    // 2. Before check-in window
    if (sched.timeWindow === "before_check_in") {
      return {
        success: true,
        alreadyPresent: hasCheckedIn,
        message: sched.message,
        data: {
          userName: userProfile.fullName ?? "Unknown",
          nis: userProfile.nis ?? cleanNis,
          className: userProfile.className ?? "-",
          status: "Belum Waktunya",
          date: displayDate,
          actionType: "none",
          actionable: false,
        },
      };
    }

    // 3. In Check-in or Late window
    if (sched.timeWindow === "check_in" || sched.timeWindow === "late") {
      if (hasCheckedIn) {
        return {
          success: true,
          alreadyPresent: true,
          message: `Siswa ${userProfile.fullName} (${cleanNis}) sudah melakukan presensi masuk hari ini.`,
          data: {
            userName: userProfile.fullName ?? "Unknown",
            nis: userProfile.nis ?? cleanNis,
            className: userProfile.className ?? "-",
            status: "Sudah Masuk",
            date: displayDate,
            actionType: "none",
            actionable: false,
          },
        };
      }

      const statusLabel = sched.timeWindow === "late" ? "Terlambat" : "Hadir";
      return {
        success: true,
        alreadyPresent: false,
        message: sched.message,
        data: {
          userName: userProfile.fullName ?? "Unknown",
          nis: userProfile.nis ?? cleanNis,
          className: userProfile.className ?? "-",
          status: statusLabel,
          date: displayDate,
          actionType: "check_in",
          actionable: true,
        },
      };
    }

    // 4. Between windows (Check-in window ended, before checkout window)
    if (sched.timeWindow === "between_windows") {
      if (hasCheckedIn) {
        return {
          success: true,
          alreadyPresent: true,
          message: `Siswa ${userProfile.fullName} (${cleanNis}) sudah presensi masuk. Presensi pulang dibuka pukul ${sched.schedule?.mulaiPulang ?? "-"}.`,
          data: {
            userName: userProfile.fullName ?? "Unknown",
            nis: userProfile.nis ?? cleanNis,
            className: userProfile.className ?? "-",
            status: "Menunggu Pulang",
            date: displayDate,
            actionType: "none",
            actionable: false,
          },
        };
      }

      return {
        success: true,
        alreadyPresent: false,
        message: `Waktu presensi masuk telah habis. Presensi pulang dibuka pukul ${sched.schedule?.mulaiPulang ?? "-"}.`,
        data: {
          userName: userProfile.fullName ?? "Unknown",
          nis: userProfile.nis ?? cleanNis,
          className: userProfile.className ?? "-",
          status: "Waktu Habis",
          date: displayDate,
          actionType: "none",
          actionable: false,
        },
      };
    }

    // 5. In Checkout window
    if (sched.timeWindow === "check_out") {
      return {
        success: true,
        alreadyPresent: false,
        message: "Waktu presensi pulang",
        data: {
          userName: userProfile.fullName ?? "Unknown",
          nis: userProfile.nis ?? cleanNis,
          className: userProfile.className ?? "-",
          status: "Pulang",
          date: displayDate,
          actionType: "check_out",
          actionable: true,
        },
      };
    }

    // 6. After checkout or holiday / no schedule
    return {
      success: true,
      alreadyPresent: hasCheckedIn || hasCheckedOut,
      message: sched.message,
      data: {
        userName: userProfile.fullName ?? "Unknown",
        nis: userProfile.nis ?? cleanNis,
        className: userProfile.className ?? "-",
        status: hasCheckedIn ? "Selesai" : "Tutup",
        date: displayDate,
        actionType: "none",
        actionable: false,
      },
    };
  } catch (error) {
    console.error("Error checking attendance:", error);
    return {
      success: false,
      message: "Terjadi kesalahan saat mengecek status absensi",
    };
  }
}

export async function saveAttendance(
  nis: string,
  actionType: "check_in" | "check_out",
  latitude: number,
  longitude: number,
  _photoPath?: string,
): Promise<AbsenceResult> {
  try {
    const cleanNis = sanitizeNis(nis);
    const userProfile = await findUserByNis(cleanNis);

    if (!userProfile) {
      return {
        success: false,
        message: `NIS "${cleanNis}" tidak ditemukan dalam sistem`,
      };
    }

    if (!userProfile.userId.trim()) {
      return {
        success: false,
        message: "Akun siswa belum terhubung. Hubungi admin sekolah.",
      };
    }

    const todayStr = getWibDateStr(new Date());

    // Double check to prevent race condition
    const history = await getStudentAttendanceToday(
      userProfile.userId,
      todayStr,
    );
    if (!history.available) {
      return { success: false, message: ATTENDANCE_HISTORY_ERROR };
    }
    if (actionType === "check_in" && history.hasCheckedIn) {
      return {
        success: false,
        alreadyPresent: true,
        message: `Siswa ${userProfile.fullName} (${cleanNis}) sudah melakukan presensi masuk hari ini.`,
      };
    }
    if (actionType === "check_out" && history.hasCheckedOut) {
      return {
        success: false,
        alreadyPresent: true,
        message: `Siswa ${userProfile.fullName} (${cleanNis}) sudah menyelesaikan seluruh presensi hari ini.`,
      };
    }

    const statusLabel = actionType === "check_in" ? "Hadir" : "Pulang";

    const astraRes = await fetch(
      `${astraApiUrl()}/v1/admin/attendance/manual`,
      {
        method: "POST",
        headers: await astraHeaders(),
        body: JSON.stringify({
          user_id: userProfile.userId,
          action_type: actionType,
          status: statusLabel,
          date: todayStr,
          latitude,
          longitude,
          reason: "Kiosk terminal scan",
        }),
        signal: AbortSignal.timeout(3000),
      },
    );

    if (!astraRes.ok) {
      return {
        success: false,
        message: `Gagal mencatat presensi ke Astra (HTTP ${astraRes.status}).`,
      };
    }

    const displayDate = formatDisplayDate(new Date());
    return {
      success: true,
      message: `Presensi ${statusLabel.toLowerCase()} berhasil dicatat.`,
      data: {
        userName: userProfile.fullName ?? "Unknown",
        nis: userProfile.nis ?? cleanNis,
        className: userProfile.className ?? "-",
        status: statusLabel,
        date: displayDate,
        actionType,
        actionable: false,
      },
    };
  } catch (error) {
    console.error("Error saving attendance:", error);
    return {
      success: false,
      message: "Terjadi kesalahan saat menyimpan absensi",
    };
  }
}

export type StrippedAbsenceData = Omit<
  AbsenceData,
  "actionType" | "actionable"
>;

export type KioskAbsenceResult = Omit<AbsenceResult, "data"> & {
  data?: StrippedAbsenceData;
};

const stripActionFields = (data: AbsenceData): StrippedAbsenceData => {
  const { actionType: _, actionable: __, ...rest } = data;
  return rest;
};

export async function checkNisAndCreateAbsence(
  nis: string,
): Promise<KioskAbsenceResult> {
  try {
    const lat = env.KIOSK_LATITUDE ?? -7.44998;
    const lon = env.KIOSK_LONGITUDE ?? 110.2236;

    const statusResult = await checkAttendanceStatus(nis, lat, lon);

    if (!statusResult.success) {
      return {
        ...statusResult,
        data: statusResult.data
          ? stripActionFields(statusResult.data)
          : undefined,
      };
    }

    const { actionType, actionable } = statusResult.data ?? {};

    if (!actionable || actionType === "none" || !actionType) {
      return {
        success: false,
        alreadyPresent: statusResult.alreadyPresent ?? false,
        message: statusResult.message,
        data: statusResult.data
          ? stripActionFields(statusResult.data)
          : undefined,
      };
    }

    const saveResult = await saveAttendance(nis, actionType, lat, lon);

    return {
      ...saveResult,
      data: saveResult.data ? stripActionFields(saveResult.data) : undefined,
    };
  } catch (error) {
    console.error("Error creating absence:", error);
    return {
      success: false,
      message: "Terjadi kesalahan saat memproses absensi",
    };
  }
}
