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

type ScheduleTimeWindow =
  | "check_in"
  | "late"
  | "check_out"
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

interface AstraUserResponse {
  data?:
    | Array<{
        id: string;
        user_id?: string;
        nis?: string;
        full_name?: string;
        fullName?: string;
        class_name?: string;
        className?: string;
        avatar_url?: string;
        email?: string;
        absence_number?: string;
        gender?: string;
      }>
    | {
        id: string;
        user_id?: string;
        nis?: string;
        full_name?: string;
        fullName?: string;
        class_name?: string;
        className?: string;
        avatar_url?: string;
        email?: string;
        absence_number?: string;
        gender?: string;
      };
}

const astraApiUrl = (): string => {
  if (!env.ASTRA_API_URL) {
    throw new Error("Astra API URL is not configured");
  }

  return env.ASTRA_API_URL;
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
  const res = await fetch(
    `${astraApiUrl()}/v1/admin/users?nis=${encodeURIComponent(nis)}`,
    {
      headers: await astraHeaders(),
      signal: AbortSignal.timeout(3000),
    },
  );
  if (!res.ok) {
    throw new Error(`Astra user lookup failed with HTTP ${res.status}`);
  }

  const data = (await res.json()) as AstraUserResponse;
  const user = Array.isArray(data.data) ? data.data[0] : data.data;
  if (!user) return null;

  return {
    id: user.id,
    userId: user.user_id || user.id,
    nis: user.nis || nis,
    fullName: user.full_name || user.fullName || `Siswa ${nis}`,
    className: user.class_name || user.className || "-",
    role: "student",
    avatarUrl: user.avatar_url || null,
    email: user.email || null,
    absenceNumber: user.absence_number || null,
    gender: user.gender || null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
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

    const schedDef = DEFAULT_SCHEDULES[day] ?? {
      mulaiMasuk: "06:00",
      selesaiMasuk: "23:59",
      mulaiPulang: "11:00",
      selesaiPulang: "23:59",
      kompensasiWaktu: 60,
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

    const [tw, msg]: [ScheduleTimeWindow, string] =
      mins >= masukStart && mins <= masukEnd
        ? ["check_in", "Waktu presensi masuk"]
        : mins > masukEnd && mins <= masukLate
          ? ["late", "Terlambat (masa kompensasi)"]
          : mins >= pulangStart && mins <= pulangEnd
            ? ["check_out", "Waktu presensi pulang"]
            : ["check_in", "Waktu presensi masuk"];

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

    const sched = await checkScheduleStatus();
    const displayDate = formatDisplayDate(new Date());

    let actionType: "check_in" | "check_out" | "none" = "check_in";
    let actionable = true;
    let statusLabel = "Hadir";

    if (sched.timeWindow === "check_in" || sched.timeWindow === "late") {
      actionType = "check_in";
      actionable = true;
      statusLabel = sched.timeWindow === "late" ? "Terlambat" : "Hadir";
    } else if (sched.timeWindow === "check_out") {
      actionType = "check_out";
      actionable = true;
      statusLabel = "Pulang";
    }

    return {
      success: true,
      alreadyPresent: false,
      message: actionable ? sched.message : "Di luar jadwal presensi aktif",
      data: {
        userName: userProfile.fullName ?? "Unknown",
        nis: userProfile.nis ?? cleanNis,
        className: userProfile.className ?? "-",
        status: statusLabel,
        date: displayDate,
        actionType,
        actionable,
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

    const todayStr = new Date().toISOString().split("T")[0] ?? "2026-08-28";
    const statusLabel = actionType === "check_in" ? "Hadir" : "Pulang";

    const astraRes = await fetch(
      `${astraApiUrl()}/v1/admin/attendance/manual`,
      {
        method: "POST",
        headers: await astraHeaders(),
        body: JSON.stringify({
          user_id: userProfile.userId,
          action_type: actionType,
          status: statusLabel.toLowerCase(),
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
      const isCompleted = statusResult.message.includes(
        "menyelesaikan absensi",
      );
      const statusLabel = isCompleted
        ? "Selesai"
        : actionType === "check_out"
          ? "Menunggu Pulang"
          : "Belum Absen";

      return {
        success: false,
        alreadyPresent: isCompleted,
        message: statusResult.message,
        data: statusResult.data
          ? { ...stripActionFields(statusResult.data), status: statusLabel }
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
