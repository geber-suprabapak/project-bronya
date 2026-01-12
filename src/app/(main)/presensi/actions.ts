"use server";

import { eq } from "drizzle-orm";
import { createClient } from "~/lib/supabase-server";
import { db } from "~/server/db";
import { userProfiles } from "~/server/db/schema";

type AttendanceActionResponse = {
    actionable: boolean;
    action_type: "check_in" | "check_out" | "none";
    message: string;
    details: {
        location_name?: string;
        status?: string;
    } | null;
};

type AbsenceData = {
    userName: string;
    nis: string;
    className: string;
    status: string;
    date: string;
    actionType: "check_in" | "check_out" | "none";
    actionable: boolean;
};

type AbsenceResult = {
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

const findUserByNis = async (nis: string) => {
    const result = await db
        .select()
        .from(userProfiles)
        .where(eq(userProfiles.nis, nis))
        .limit(1);
    return result[0];
};

type ScheduleTimeWindow =
    | "check_in"
    | "late"
    | "check_out"
    | "outside"
    | "no_schedule";

type ScheduleStatus = {
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

const KIOSK_LATITUDE = -7.44998;
const KIOSK_LONGITUDE = 110.2236;

const toMinutes = (t: string) => {
    const [h, m] = t.split(":").map(Number);
    return (h ?? 0) * 60 + (m ?? 0);
};

export async function checkScheduleStatus(): Promise<ScheduleStatus> {
    try {
        const supabase = await createClient();
        const now = new Date();
        const wib = new Date(
            now.toLocaleString("en-US", { timeZone: "Asia/Jakarta" }),
        );
        const day = DAYS_ID[wib.getDay()];
        if (!day) {
            return {
                success: false,
                timeWindow: "no_schedule",
                message: "Hari tidak valid",
            };
        }
        const mins = wib.getHours() * 60 + wib.getMinutes();

        const { data } = await supabase
            .from("jadwal_absensi")
            .select("*")
            .eq("hari", day)
            .eq("is_active", true)
            .single();

        if (!data)
            return {
                success: true,
                timeWindow: "no_schedule",
                message: "Tidak ada jadwal hari ini",
            };

        const s = {
            hari: data.hari,
            mulaiMasuk: data.mulai_masuk,
            selesaiMasuk: data.selesai_masuk,
            mulaiPulang: data.mulai_pulang,
            selesaiPulang: data.selesai_pulang,
            kompensasiWaktu: data.kompensasi_waktu,
        };

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
                        : ["outside", "Di luar jadwal presensi"];

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
    latitude: number,
    longitude: number,
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

        const supabase = await createClient();
        const { data, error } = await supabase.rpc(
            "get_and_validate_attendance_action",
            {
                p_user_id: userProfile.userId,
                p_user_lat: latitude,
                p_user_lon: longitude,
            },
        );

        if (error) {
            console.error("RPC Error:", error);
            return { success: false, message: "Gagal mengecek status absensi" };
        }

        const result = data as AttendanceActionResponse;
        const displayDate = formatDisplayDate(new Date());

        const statusLabel =
            result.action_type === "check_in"
                ? (result.details?.status ?? "Hadir")
                : result.action_type === "check_out"
                    ? "Pulang"
                    : "Selesai";

        return {
            success: true,
            alreadyPresent: !result.actionable && result.action_type === "none",
            message: result.message,
            data: {
                userName: userProfile.fullName ?? "Unknown",
                nis: userProfile.nis ?? cleanNis,
                className: userProfile.className ?? "-",
                status: statusLabel,
                date: displayDate,
                actionType: result.action_type,
                actionable: result.actionable,
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
    photoPath?: string,
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

        const supabase = await createClient();
        const { data, error } = await supabase.rpc("save_attendance_record", {
            p_user_id: userProfile.userId,
            p_action_type: actionType,
            p_photo_path: photoPath ?? null,
            p_latitude: latitude,
            p_longitude: longitude,
        });

        if (error) {
            console.error("RPC Error:", error);
            return { success: false, message: "Gagal menyimpan absensi" };
        }

        const result = data as {
            success: boolean;
            message: string;
            attendance_id?: string;
        };
        const displayDate = formatDisplayDate(new Date());

        if (!result.success) {
            return { success: false, message: result.message };
        }

        const statusLabel = actionType === "check_in" ? "Hadir" : "Pulang";

        return {
            success: true,
            message: result.message,
            data: {
                userName: userProfile.fullName ?? "Unknown",
                nis: userProfile.nis ?? cleanNis,
                className: userProfile.className ?? "-",
                status: statusLabel,
                date: displayDate,
                actionType: actionType,
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

const sanitizeNis = (input: string) => {
    // Remove common barcode AIM identifiers (e.g., ]C1 for Code 128)
    const clean = input.replace(/^\][A-Za-z]\d/, "");
    // Remove all non-numeric characters
    return clean.replace(/\D/g, "");
};

type KioskAbsenceResult = Omit<AbsenceResult, "data"> & {
    data?: Omit<AbsenceData, "actionType" | "actionable">;
};

type StrippedAbsenceData = Omit<AbsenceData, "actionType" | "actionable">;

const stripActionFields = (data: AbsenceData): StrippedAbsenceData => {
    const { actionType: _, actionable: __, ...rest } = data;
    return rest;
};

export async function checkNisAndCreateAbsence(
    nis: string,
): Promise<KioskAbsenceResult> {
    try {
        const statusResult = await checkAttendanceStatus(
            nis,
            KIOSK_LATITUDE,
            KIOSK_LONGITUDE,
        );

        if (!statusResult.success) {
            return {
                ...statusResult,
                data: statusResult.data ? stripActionFields(statusResult.data) : undefined,
            };
        }

        const { actionType, actionable } = statusResult.data ?? {};

        if (!actionable || actionType === "none" || !actionType) {
            const isCompleted = statusResult.message.includes("menyelesaikan absensi");
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

        const saveResult = await saveAttendance(
            nis,
            actionType,
            KIOSK_LATITUDE,
            KIOSK_LONGITUDE,
        );

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
