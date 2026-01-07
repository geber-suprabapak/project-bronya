"use server";

import { db } from "~/server/db";
import { userProfiles, absences } from "~/server/db/schema";
import { eq, and } from "drizzle-orm";

type AbsenceResult = {
    success: boolean;
    message: string;
    alreadyPresent?: boolean;
    data?: {
        userName: string;
        nis: string;
        className: string;
        status: string;
        date: string;
    };
};

export async function checkNisAndCreateAbsence(
    nis: string
): Promise<AbsenceResult> {
    try {
        // Find user by NIS
        const user = await db
            .select()
            .from(userProfiles)
            .where(eq(userProfiles.nis, nis))
            .limit(1);

        if (user.length === 0) {
            return {
                success: false,
                message: `NIS "${nis}" tidak ditemukan dalam sistem`,
            };
        }

        const userProfile = user[0]!;

        // Get current date in YYYY-MM-DD format
        const today = new Date();
        const dateStr = today.toISOString().split("T")[0]!;

        // Check if student already has absence record for today
        const existingAbsence = await db
            .select()
            .from(absences)
            .where(
                and(
                    eq(absences.userId, userProfile.userId),
                    eq(absences.date, dateStr)
                )
            )
            .limit(1);

        // Format date for display
        const displayDate = today.toLocaleDateString("id-ID", {
            weekday: "long",
            year: "numeric",
            month: "long",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit",
        });

        if (existingAbsence.length > 0) {
            return {
                success: false,
                alreadyPresent: true,
                message: "Anda sudah melakukan presensi hari ini!",
                data: {
                    userName: userProfile.fullName ?? "Unknown",
                    nis: userProfile.nis ?? nis,
                    className: userProfile.className ?? "-",
                    status: existingAbsence[0]!.status,
                    date: displayDate,
                },
            };
        }

        // Determine status based on current time
        const currentHour = today.getHours();
        const currentMinute = today.getMinutes();
        const currentTime = currentHour * 60 + currentMinute;

        // Define time boundaries (can be adjusted)
        const masukStart = 6 * 60; // 06:00
        const masukEnd = 7 * 60; // 07:00 (on time)
        const terlambatEnd = 8 * 60; // 08:00 (late cutoff)
        const pulangStart = 14 * 60; // 14:00

        let status: "Hadir" | "Terlambat" | "Pulang" | "Alpha";

        if (currentTime >= masukStart && currentTime <= masukEnd) {
            status = "Hadir";
        } else if (currentTime > masukEnd && currentTime <= terlambatEnd) {
            status = "Terlambat";
        } else if (currentTime >= pulangStart) {
            status = "Pulang";
        } else {
            status = "Hadir"; // Default to Hadir for other times
        }

        // Create absence record
        await db.insert(absences).values({
            userId: userProfile.userId,
            date: dateStr,
            status: status,
            reason: null,
            photoUrl: null,
            latitude: null,
            longitude: null,
        });

        return {
            success: true,
            message: "Absensi berhasil dicatat!",
            data: {
                userName: userProfile.fullName ?? "Unknown",
                nis: userProfile.nis ?? nis,
                className: userProfile.className ?? "-",
                status: status,
                date: displayDate,
            },
        };
    } catch (error) {
        console.error("Error creating absence:", error);
        return {
            success: false,
            message: "Terjadi kesalahan saat memproses absensi",
        };
    }
}
