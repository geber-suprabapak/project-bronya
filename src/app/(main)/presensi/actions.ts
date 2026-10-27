"use server";

import { getAccessToken } from "@logto/next/server-actions";
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

export type ScheduleStatus = {
  success: boolean;
  timeWindow: ScheduleTimeWindow;
  message: string;
  schedule?: {
    hari: string;
    mulaiMasuk: string;
    selesaiMasuk: string;
    mulaiPulang: string;
    selesaiPulang: string;
    kompensasiWaktu: number;
  };
};

const DAYS_ID = [
  "minggu",
  "senin",
  "selasa",
  "rabu",
  "kamis",
  "jumat",
  "sabtu",
];

const DEFAULT_SCHEDULES: Record<
  string,
  {
    mulaiMasuk: string;
    selesaiMasuk: string;
    mulaiPulang: string;
    selesaiPulang: string;
    kompensasiWaktu: number;
  }
> = {
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
};

const toMinutes = (t: string) => {
  const [h, m] = t.split(":").map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
};

interface AstraStudent {
  id?: string;
  user_id?: string;
  userId?: string;
  nis?: string;
  full_name?: string;
  fullName?: string;
  class_name?: string;
  className?: string;
  avatar_url?: string;
  avatarUrl?: string;
  email?: string;
  absence_number?: string;
  absenceNumber?: string;
  gender?: string;
  role?: string;
  lifecycle_status?: string;
}

interface AstraStudentsResponse {
  success?: boolean;
  message?: string;
  data?: AstraStudent[];
}

interface AstraAttendance {
  id?: string;
  user_id?: string;
  userId?: string;
  date?: string;
  status?: string;
  action_type?: string;
  actionType?: string;
  created_at?: string;
}

interface AstraAttendanceResponse {
  success?: boolean;
  message?: string;
  data?: AstraAttendance[];
}

interface AstraSchedule {
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

interface AstraSchedulesResponse {
  success?: boolean;
  message?: string;
  data?: AstraSchedule[];
}

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
    const payload = JSON.parse(
      Buffer.from(payloadSegment, "base64url").toString("utf8"),
    ) as {
      iss?: unknown;
      aud?: unknown;
      scope?: unknown;
      exp?: unknown;
    };
    const audience = Array.isArray(payload.aud)
      ? payload.aud.filter(
          (value): value is string => typeof value === "string",
        )
      : typeof payload.aud === "string"
        ? [payload.aud]
        : [];
    const scopes =
      typeof payload.scope === "string"
        ? payload.scope.split(" ").filter(Boolean)
        : [];

    return {
      format: "jwt",
      issuer: typeof payload.iss === "string" ? payload.iss : null,
      audience,
      scopes,
      expired:
        typeof payload.exp === "number"
          ? payload.exp <= Date.now() / 1000
          : null,
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

  const data = (await res.json()) as AstraStudentsResponse;
  const students = Array.isArray(data.data)
    ? data.data
    : Array.isArray(data)
      ? (data as AstraStudent[])
      : [];

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
): Promise<{
  hasCheckedIn: boolean;
  hasCheckedOut: boolean;
  checkInRecord?: AstraAttendance;
  checkOutRecord?: AstraAttendance;
}> => {
  try {
    const headers = await astraHeaders();
    const res = await fetch(
      `${astraApiUrl()}/v1/admin/attendance?userId=${encodeURIComponent(userId)}&date=${encodeURIComponent(dateStr)}`,
      {
        headers,
        signal: AbortSignal.timeout(3000),
      },
    );
    if (!res.ok) {
      return { hasCheckedIn: false, hasCheckedOut: false };
    }
    const data = (await res.json()) as AstraAttendanceResponse;
    const records = Array.isArray(data.data)
      ? data.data
      : Array.isArray(data)
        ? (data as AstraAttendance[])
        : [];

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
      hasCheckedIn: Boolean(checkInRecord),
      hasCheckedOut: Boolean(checkOutRecord),
      checkInRecord,
      checkOutRecord,
    };
  } catch (error) {
    console.error("Error fetching student attendance history:", error);
    return { hasCheckedIn: false, hasCheckedOut: false };
  }
};

const fetchActiveScheduleFromAstra = async (
  day: string,
): Promise<{
  mulaiMasuk: string;
  selesaiMasuk: string;
  mulaiPulang: string;
  selesaiPulang: string;
  kompensasiWaktu: number;
} | null> => {
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
    const data = (await res.json()) as AstraSchedulesResponse;
    const schedules = Array.isArray(data.data)
      ? data.data
      : Array.isArray(data)
        ? (data as AstraSchedule[])
        : [];
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
      DEFAULT_SCHEDULES[day] ?? {
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
  } catch (_error) {
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

    const todayStr = getWibDateStr(new Date());
    const [sched, history] = await Promise.all([
      checkScheduleStatus(),
      getStudentAttendanceToday(userProfile.userId, todayStr),
    ]);

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

    const todayStr = getWibDateStr(new Date());

    // Double check to prevent race condition
    const history = await getStudentAttendanceToday(
      userProfile.userId,
      todayStr,
    );
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
