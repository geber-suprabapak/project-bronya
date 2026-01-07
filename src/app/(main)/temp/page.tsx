import { createClient } from "@/lib/supabase-server";
import { redirect } from "next/navigation";
import { db } from "~/server/db";
import { userProfiles, absences } from "~/server/db/schema";
import { desc } from "drizzle-orm";

export default async function IndexPage() {
    const supabase = await createClient();

    const {
        data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
        redirect("/login");
    }

    // Use Drizzle ORM - bypasses RLS
    const [userProfilesData, absencesData] = await Promise.all([
        db.query.userProfiles.findMany({
            orderBy: [desc(userProfiles.createdAt)],
        }),
        db.query.absences.findMany({
            orderBy: [desc(absences.date)],
        }),
    ]);

    const handleLogout = async () => {
        "use server";
        const supabase = await createClient();
        await supabase.auth.signOut();
        redirect("/login");
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 p-8">
            <div className="max-w-7xl mx-auto">
                <div className="flex justify-between items-center mb-8">
                    <div>
                        <h1 className="text-3xl font-bold text-white mb-2">✅ Drizzle ORM Connected!</h1>
                        <p className="text-gray-400">
                            Logged in as: <span className="text-purple-400">{user.email}</span>
                        </p>
                    </div>
                    <form action={handleLogout}>
                        <button
                            type="submit"
                            className="px-6 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg border border-white/20 transition-all duration-200 flex items-center gap-2"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                            </svg>
                            Logout
                        </button>
                    </form>
                </div>

                {/* Data Info Banner */}
                <div className="mb-8 bg-green-500/10 backdrop-blur-lg rounded-2xl border border-green-500/30 p-4">
                    <p className="text-green-300 text-sm">
                        🚀 Using <strong>Drizzle ORM</strong> with direct PostgreSQL connection (bypasses RLS)
                    </p>
                    <p className="text-green-400/70 text-xs mt-1">
                        User Profiles: {userProfilesData.length} | Absences: {absencesData.length}
                    </p>
                </div>

                <div className="grid gap-8">
                    {/* User Profiles Table */}
                    <div className="bg-white/10 backdrop-blur-lg rounded-2xl border border-white/20 overflow-hidden">
                        <div className="p-6 border-b border-white/10">
                            <h2 className="text-xl font-semibold text-white">User Profiles</h2>
                            <p className="text-gray-400 text-sm mt-1">
                                Data dari tabel <code className="bg-white/10 px-2 py-0.5 rounded text-purple-300">user_profiles</code>
                            </p>
                        </div>

                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead className="bg-white/5">
                                    <tr>
                                        <th className="px-4 py-3 text-left text-sm font-semibold text-gray-300 border-b border-white/10">NIS</th>
                                        <th className="px-4 py-3 text-left text-sm font-semibold text-gray-300 border-b border-white/10">Nama</th>
                                        <th className="px-4 py-3 text-left text-sm font-semibold text-gray-300 border-b border-white/10">Email</th>
                                        <th className="px-4 py-3 text-left text-sm font-semibold text-gray-300 border-b border-white/10">Kelas</th>
                                        <th className="px-4 py-3 text-left text-sm font-semibold text-gray-300 border-b border-white/10">No. Absen</th>
                                        <th className="px-4 py-3 text-left text-sm font-semibold text-gray-300 border-b border-white/10">Gender</th>
                                        <th className="px-4 py-3 text-left text-sm font-semibold text-gray-300 border-b border-white/10">Role</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {userProfilesData.length > 0 ? (
                                        userProfilesData.map((profile) => (
                                            <tr key={profile.id} className="hover:bg-white/5 transition-colors">
                                                <td className="px-4 py-3 text-sm text-gray-200 border-b border-white/5">{profile.nis || "-"}</td>
                                                <td className="px-4 py-3 text-sm text-gray-200 border-b border-white/5">{profile.fullName || "-"}</td>
                                                <td className="px-4 py-3 text-sm text-gray-200 border-b border-white/5">{profile.email || "-"}</td>
                                                <td className="px-4 py-3 text-sm text-gray-200 border-b border-white/5">{profile.className || "-"}</td>
                                                <td className="px-4 py-3 text-sm text-gray-200 border-b border-white/5">{profile.absenceNumber || "-"}</td>
                                                <td className="px-4 py-3 text-sm text-gray-200 border-b border-white/5">{profile.gender || "-"}</td>
                                                <td className="px-4 py-3 text-sm border-b border-white/5">
                                                    <span className="px-2 py-1 rounded-full text-xs font-medium bg-purple-500/20 text-purple-300 border border-purple-500/30">
                                                        {profile.role || "-"}
                                                    </span>
                                                </td>
                                            </tr>
                                        ))
                                    ) : (
                                        <tr>
                                            <td colSpan={7} className="px-4 py-8 text-center text-gray-400">
                                                Tidak ada data user profiles
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>

                        <div className="p-4 bg-white/5 border-t border-white/10">
                            <p className="text-sm text-gray-400">
                                Total: <span className="text-purple-300 font-medium">{userProfilesData.length}</span> data
                            </p>
                        </div>
                    </div>

                    {/* Absences Table */}
                    <div className="bg-white/10 backdrop-blur-lg rounded-2xl border border-white/20 overflow-hidden">
                        <div className="p-6 border-b border-white/10">
                            <h2 className="text-xl font-semibold text-white">Absences</h2>
                            <p className="text-gray-400 text-sm mt-1">
                                Data dari tabel <code className="bg-white/10 px-2 py-0.5 rounded text-purple-300">absences</code>
                            </p>
                        </div>

                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead className="bg-white/5">
                                    <tr>
                                        <th className="px-4 py-3 text-left text-sm font-semibold text-gray-300 border-b border-white/10">ID</th>
                                        <th className="px-4 py-3 text-left text-sm font-semibold text-gray-300 border-b border-white/10">User ID</th>
                                        <th className="px-4 py-3 text-left text-sm font-semibold text-gray-300 border-b border-white/10">Tanggal</th>
                                        <th className="px-4 py-3 text-left text-sm font-semibold text-gray-300 border-b border-white/10">Alasan</th>
                                        <th className="px-4 py-3 text-left text-sm font-semibold text-gray-300 border-b border-white/10">Status</th>
                                        <th className="px-4 py-3 text-left text-sm font-semibold text-gray-300 border-b border-white/10">Created At</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {absencesData.length > 0 ? (
                                        absencesData.map((absence) => (
                                            <tr key={absence.id} className="hover:bg-white/5 transition-colors">
                                                <td className="px-4 py-3 text-sm text-gray-200 border-b border-white/5 font-mono">{absence.id.slice(0, 8)}...</td>
                                                <td className="px-4 py-3 text-sm text-gray-200 border-b border-white/5 font-mono">{absence.userId.slice(0, 8)}...</td>
                                                <td className="px-4 py-3 text-sm text-gray-200 border-b border-white/5">{absence.date}</td>
                                                <td className="px-4 py-3 text-sm text-gray-200 border-b border-white/5">{absence.reason || "-"}</td>
                                                <td className="px-4 py-3 text-sm border-b border-white/5">
                                                    <span
                                                        className={`px-2 py-1 rounded-full text-xs font-medium ${absence.status === "Hadir"
                                                                ? "bg-green-500/20 text-green-300 border border-green-500/30"
                                                                : absence.status === "Terlambat"
                                                                    ? "bg-yellow-500/20 text-yellow-300 border border-yellow-500/30"
                                                                    : absence.status === "Alpha"
                                                                        ? "bg-red-500/20 text-red-300 border border-red-500/30"
                                                                        : "bg-blue-500/20 text-blue-300 border border-blue-500/30"
                                                            }`}
                                                    >
                                                        {absence.status}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-3 text-sm text-gray-200 border-b border-white/5">
                                                    {absence.createdAt.toLocaleString("id-ID")}
                                                </td>
                                            </tr>
                                        ))
                                    ) : (
                                        <tr>
                                            <td colSpan={6} className="px-4 py-8 text-center text-gray-400">
                                                Tidak ada data absences
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>

                        <div className="p-4 bg-white/5 border-t border-white/10">
                            <p className="text-sm text-gray-400">
                                Total: <span className="text-purple-300 font-medium">{absencesData.length}</span> data
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
