"use server";

import { createClient } from "~/lib/supabase-server";
import { db } from "~/server/db";
import { userProfiles } from "~/server/db/schema";
import { eq } from "drizzle-orm";

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

export async function checkAttendanceStatus(
    nis: string,
    latitude: number,
    longitude: number
): Promise<AbsenceResult> {
    try {
        const userProfile = await findUserByNis(nis);

        if (!userProfile) {
            return { success: false, message: `NIS "${nis}" tidak ditemukan dalam sistem` };
        }

        const supabase = await createClient();
        const { data, error } = await supabase.rpc("get_and_validate_attendance_action", {
            p_user_id: userProfile.userId,
            p_user_lat: latitude,
            p_user_lon: longitude,
        });

        if (error) {
            console.error("RPC Error:", error);
            return { success: false, message: "Gagal mengecek status absensi" };
        }

        const result = data as AttendanceActionResponse;
        const displayDate = formatDisplayDate(new Date());

        const statusLabel = result.action_type === "check_in"
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
                nis: userProfile.nis ?? nis,
                className: userProfile.className ?? "-",
                status: statusLabel,
                date: displayDate,
                actionType: result.action_type,
                actionable: result.actionable,
            },
        };
    } catch (error) {
        console.error("Error checking attendance:", error);
        return { success: false, message: "Terjadi kesalahan saat mengecek status absensi" };
    }
}

export async function saveAttendance(
    nis: string,
    actionType: "check_in" | "check_out",
    latitude: number,
    longitude: number,
    photoPath?: string
): Promise<AbsenceResult> {
    try {
        const userProfile = await findUserByNis(nis);

        if (!userProfile) {
            return { success: false, message: `NIS "${nis}" tidak ditemukan dalam sistem` };
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

        const result = data as { success: boolean; message: string; attendance_id?: string };
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
                nis: userProfile.nis ?? nis,
                className: userProfile.className ?? "-",
                status: statusLabel,
                date: displayDate,
                actionType: actionType,
                actionable: false,
            },
        };
    } catch (error) {
        console.error("Error saving attendance:", error);
        return { success: false, message: "Terjadi kesalahan saat menyimpan absensi" };
    }
}

export async function checkNisAndCreateAbsence(nis: string): Promise<Omit<AbsenceResult, 'data'> & { data?: Omit<AbsenceData, 'actionType' | 'actionable'> }> {
    try {
        const userProfile = await findUserByNis(nis);

        if (!userProfile) {
            return { success: false, message: `NIS "${nis}" tidak ditemukan dalam sistem` };
        }

        const supabase = await createClient();

        const { data: statusData, error: statusError } = await supabase.rpc("get_and_validate_attendance_action", {
            p_user_id: userProfile.userId,
            p_user_lat: -7.449980,
            p_user_lon: 110.223600,
        });

        if (statusError) {
            console.error("RPC Error:", statusError);
            return { success: false, message: "Gagal mengecek status absensi" };
        }

        const status = statusData as AttendanceActionResponse;
        const displayDate = formatDisplayDate(new Date());

        if (!status.actionable) {
            const statusLabel = status.action_type === "none" ? "Selesai" : status.details?.status ?? "Hadir";
            return {
                success: false,
                alreadyPresent: true,
                message: status.message,
                data: {
                    userName: userProfile.fullName ?? "Unknown",
                    nis: userProfile.nis ?? nis,
                    className: userProfile.className ?? "-",
                    status: statusLabel,
                    date: displayDate,
                },
            };
        }

        const actionType = status.action_type as "check_in" | "check_out";
        const { data: saveData, error: saveError } = await supabase.rpc("save_attendance_record", {
            p_user_id: userProfile.userId,
            p_action_type: actionType,
            p_photo_path: null,
            p_latitude: -7.449980,
            p_longitude: 110.223600,
        });

        if (saveError) {
            console.error("RPC Error:", saveError);
            return { success: false, message: "Gagal menyimpan absensi" };
        }

        const saveResult = saveData as { success: boolean; message: string };

        if (!saveResult.success) {
            return { success: false, message: saveResult.message };
        }

        const finalStatus = actionType === "check_in"
            ? (status.details?.status ?? "Hadir")
            : "Pulang";

        return {
            success: true,
            message: saveResult.message,
            data: {
                userName: userProfile.fullName ?? "Unknown",
                nis: userProfile.nis ?? nis,
                className: userProfile.className ?? "-",
                status: finalStatus,
                date: displayDate,
            },
        };
    } catch (error) {
        console.error("Error creating absence:", error);
        return { success: false, message: "Terjadi kesalahan saat memproses absensi" };
    }
}
