"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { checkNisAndCreateAbsence } from "./actions";

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

export default function IndexPage() {
    const [nis, setNis] = useState("");
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState<AbsenceResult | null>(null);
    const [scanMode, setScanMode] = useState(true);
    const inputRef = useRef<HTMLInputElement>(null);
    const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

    // Auto-focus input on mount and after processing
    useEffect(() => {
        if (!loading && inputRef.current) {
            inputRef.current.focus();
        }
    }, [loading, result]);

    // Re-focus input when clicking anywhere on the page (for scanner mode)
    useEffect(() => {
        const handleClick = () => {
            if (scanMode && inputRef.current && !loading) {
                inputRef.current.focus();
            }
        };

        document.addEventListener("click", handleClick);
        return () => document.removeEventListener("click", handleClick);
    }, [scanMode, loading]);

    // Auto-clear result after 5 seconds
    useEffect(() => {
        if (result) {
            const timer = setTimeout(() => {
                setResult(null);
                if (inputRef.current) {
                    inputRef.current.focus();
                }
            }, 5000);
            return () => clearTimeout(timer);
        }
    }, [result]);

    // Cleanup debounce timer on unmount
    useEffect(() => {
        return () => {
            if (debounceTimerRef.current) {
                clearTimeout(debounceTimerRef.current);
            }
        };
    }, []);

    const processAbsence = useCallback(async (nisValue: string) => {
        if (!nisValue.trim() || loading) return;

        setLoading(true);
        setResult(null);

        try {
            const response = await checkNisAndCreateAbsence(nisValue.trim());
            setResult(response);
            setNis(""); // Always clear input for next scan
        } catch (error) {
            setResult({
                success: false,
                message: "Terjadi kesalahan saat memproses data",
            });
            setNis("");
        } finally {
            setLoading(false);
        }
    }, [loading]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        await processAbsence(nis);
    };

    // Handle input change with auto-submit for scanner mode
    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const value = e.target.value;
        setNis(value);

        // In scan mode, auto-submit after input stops (debounce)
        if (scanMode && value.trim()) {
            // Clear existing timer
            if (debounceTimerRef.current) {
                clearTimeout(debounceTimerRef.current);
            }

            // Set new timer - submit after 200ms of no input
            debounceTimerRef.current = setTimeout(() => {
                processAbsence(value);
            }, 200);
        }
    };

    // Handle keyboard input - also support Enter key
    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === "Enter") {
            e.preventDefault();
            // Clear debounce timer and submit immediately
            if (debounceTimerRef.current) {
                clearTimeout(debounceTimerRef.current);
            }
            processAbsence(nis);
        }
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center p-4">
            <div className="w-full max-w-md">
                {/* Card Container */}
                <div className="backdrop-blur-xl bg-white/10 rounded-3xl shadow-2xl border border-white/20 p-8">
                    {/* Header */}
                    <div className="text-center mb-8">
                        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-purple-500 to-pink-500 mb-4 shadow-lg shadow-purple-500/30">
                            {/* QR Code Icon */}
                            <svg
                                className="w-8 h-8 text-white"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                            >
                                <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h2M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z"
                                />
                            </svg>
                        </div>
                        <h1 className="text-2xl font-bold text-white mb-2">
                            Sistem Absensi
                        </h1>
                        <p className="text-gray-300 text-sm">
                            {scanMode
                                ? "Scan QR Code untuk mencatat kehadiran"
                                : "Masukkan NIS untuk mencatat kehadiran"}
                        </p>
                    </div>

                    {/* Scan Mode Toggle */}
                    <div className="flex items-center justify-center gap-3 mb-6">
                        <span className={`text-sm ${!scanMode ? "text-white" : "text-gray-400"}`}>
                            Manual
                        </span>
                        <button
                            type="button"
                            onClick={() => setScanMode(!scanMode)}
                            className={`relative w-14 h-7 rounded-full transition-colors duration-300 ${scanMode ? "bg-purple-600" : "bg-gray-600"
                                }`}
                        >
                            <span
                                className={`absolute top-1 w-5 h-5 bg-white rounded-full shadow-md transition-transform duration-300 ${scanMode ? "translate-x-8" : "translate-x-1"
                                    }`}
                            />
                        </button>
                        <span className={`text-sm ${scanMode ? "text-white" : "text-gray-400"}`}>
                            Scan QR
                        </span>
                    </div>

                    {/* Scanner Status Indicator */}
                    {scanMode && (
                        <div className="mb-6 p-4 rounded-xl bg-purple-500/10 border border-purple-500/20">
                            <div className="flex items-center gap-3">
                                <div className="relative">
                                    <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse" />
                                    <div className="absolute inset-0 w-3 h-3 bg-green-500 rounded-full animate-ping" />
                                </div>
                                <div>
                                    <p className="text-sm font-medium text-white">
                                        Scanner Siap
                                    </p>
                                    <p className="text-xs text-gray-400">
                                        Arahkan QR Code siswa ke scanner
                                    </p>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Form */}
                    <form onSubmit={handleSubmit} className="space-y-6">
                        {scanMode ? (
                            /* Hidden input for scanner - captures input but doesn't show it */
                            <input
                                ref={inputRef}
                                type="text"
                                id="nis"
                                value={nis}
                                onChange={handleInputChange}
                                onKeyDown={handleKeyDown}
                                className="absolute opacity-0 pointer-events-none"
                                disabled={loading}
                                autoComplete="off"
                                autoFocus
                            />
                        ) : (
                            <div>
                                <label
                                    htmlFor="nis"
                                    className="block text-sm font-medium text-gray-300 mb-2"
                                >
                                    Nomor Induk Siswa (NIS)
                                </label>
                                <input
                                    ref={inputRef}
                                    type="text"
                                    id="nis"
                                    value={nis}
                                    onChange={handleInputChange}
                                    onKeyDown={handleKeyDown}
                                    placeholder="Masukkan NIS..."
                                    className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all duration-300"
                                    disabled={loading}
                                    autoComplete="off"
                                    autoFocus
                                />
                            </div>
                        )}

                        {!scanMode && (
                            <button
                                type="submit"
                                disabled={loading || !nis.trim()}
                                className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-purple-600 to-pink-600 text-white font-semibold shadow-lg shadow-purple-500/30 hover:shadow-purple-500/50 hover:scale-[1.02] active:scale-[0.98] transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 disabled:hover:shadow-purple-500/30"
                            >
                                {loading ? (
                                    <span className="inline-flex items-center justify-center">
                                        <svg
                                            className="animate-spin -ml-1 mr-3 h-5 w-5 text-white"
                                            fill="none"
                                            viewBox="0 0 24 24"
                                        >
                                            <circle
                                                className="opacity-25"
                                                cx="12"
                                                cy="12"
                                                r="10"
                                                stroke="currentColor"
                                                strokeWidth="4"
                                            />
                                            <path
                                                className="opacity-75"
                                                fill="currentColor"
                                                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                                            />
                                        </svg>
                                        Memproses...
                                    </span>
                                ) : (
                                    "Absen Sekarang"
                                )}
                            </button>
                        )}

                        {/* Loading indicator for scan mode */}
                        {scanMode && loading && (
                            <div className="flex items-center justify-center gap-3 py-3">
                                <svg
                                    className="animate-spin h-5 w-5 text-purple-400"
                                    fill="none"
                                    viewBox="0 0 24 24"
                                >
                                    <circle
                                        className="opacity-25"
                                        cx="12"
                                        cy="12"
                                        r="10"
                                        stroke="currentColor"
                                        strokeWidth="4"
                                    />
                                    <path
                                        className="opacity-75"
                                        fill="currentColor"
                                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                                    />
                                </svg>
                                <span className="text-purple-300 font-medium">Memproses...</span>
                            </div>
                        )}
                    </form>

                    {/* Result Message */}
                    {result && (
                        <div
                            className={`mt-6 p-4 rounded-xl ${result.success
                                ? "bg-green-500/20 border border-green-500/30"
                                : result.alreadyPresent
                                    ? "bg-amber-500/20 border border-amber-500/30"
                                    : "bg-red-500/20 border border-red-500/30"
                                } animate-fade-in`}
                        >
                            <div className="flex items-start gap-3">
                                {result.success ? (
                                    <svg
                                        className="w-5 h-5 text-green-400 mt-0.5 flex-shrink-0"
                                        fill="none"
                                        stroke="currentColor"
                                        viewBox="0 0 24 24"
                                    >
                                        <path
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                            strokeWidth={2}
                                            d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                                        />
                                    </svg>
                                ) : result.alreadyPresent ? (
                                    <svg
                                        className="w-5 h-5 text-amber-400 mt-0.5 flex-shrink-0"
                                        fill="none"
                                        stroke="currentColor"
                                        viewBox="0 0 24 24"
                                    >
                                        <path
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                            strokeWidth={2}
                                            d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                                        />
                                    </svg>
                                ) : (
                                    <svg
                                        className="w-5 h-5 text-red-400 mt-0.5 flex-shrink-0"
                                        fill="none"
                                        stroke="currentColor"
                                        viewBox="0 0 24 24"
                                    >
                                        <path
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                            strokeWidth={2}
                                            d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                                        />
                                    </svg>
                                )}
                                <div className="flex-1">
                                    <p
                                        className={`text-sm font-medium ${result.success
                                            ? "text-green-300"
                                            : result.alreadyPresent
                                                ? "text-amber-300"
                                                : "text-red-300"
                                            }`}
                                    >
                                        {result.message}
                                    </p>
                                    {(result.success || result.alreadyPresent) && result.data && (
                                        <div className="mt-3 space-y-1 text-sm text-gray-300">
                                            <p>
                                                <span className="text-gray-400">Nama:</span>{" "}
                                                {result.data.userName}
                                            </p>
                                            <p>
                                                <span className="text-gray-400">Kelas:</span>{" "}
                                                {result.data.className}
                                            </p>
                                            <p>
                                                <span className="text-gray-400">Status:</span>{" "}
                                                <span className={result.success ? "text-green-400" : "text-amber-400"}>
                                                    {result.data.status}
                                                </span>
                                            </p>
                                            <p>
                                                <span className="text-gray-400">Tanggal:</span>{" "}
                                                {result.data.date}
                                            </p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <p className="text-center text-gray-500 text-xs mt-6">
                    © 2026 Sistem Absensi Siswa
                </p>
            </div>
        </div>
    );
}
