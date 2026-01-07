"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { checkNisAndCreateAbsence } from "./actions";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { QrCode, Loader2, CheckCircle, AlertCircle, XCircle, Scan, Keyboard } from "lucide-react";

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
    const [activeTab, setActiveTab] = useState("scan");
    
    // Refs for inputs
    const scanInputRef = useRef<HTMLInputElement>(null);
    const manualInputRef = useRef<HTMLInputElement>(null);
    const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

    const isScanMode = activeTab === "scan";

    // Auto-focus logic
    useEffect(() => {
        if (!loading) {
            if (isScanMode && scanInputRef.current) {
                scanInputRef.current.focus();
            } else if (!isScanMode && manualInputRef.current) {
                manualInputRef.current.focus();
            }
        }
    }, [loading, isScanMode, result]);

    // Global click handler for scan mode to keep focus
    useEffect(() => {
        const handleClick = () => {
            if (isScanMode && scanInputRef.current && !loading) {
                scanInputRef.current.focus();
            }
        };

        if (isScanMode) {
            document.addEventListener("click", handleClick);
        }
        return () => document.removeEventListener("click", handleClick);
    }, [isScanMode, loading]);

    // Auto-clear result after 5 seconds
    useEffect(() => {
        if (result) {
            const timer = setTimeout(() => {
                setResult(null);
                // Refocus after clearing result
                if (isScanMode && scanInputRef.current) scanInputRef.current.focus();
                // If manual mode, user might be looking at result, maybe don't force focus? 
                // But generally good to be ready for next input.
                if (!isScanMode && manualInputRef.current) manualInputRef.current.focus();
            }, 5000);
            return () => clearTimeout(timer);
        }
    }, [result, isScanMode]);

    // Cleanup debounce
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
            setNis(""); 
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

    const handleScanInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const value = e.target.value;
        setNis(value);

        if (value.trim()) {
            if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
            debounceTimerRef.current = setTimeout(() => {
                processAbsence(value);
            }, 200);
        }
    };

    const handleManualInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setNis(e.target.value);
    };

    const handleManualSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        await processAbsence(nis);
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === "Enter") {
            e.preventDefault();
            if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
            processAbsence(nis);
        }
    };

    const handleTabChange = (value: string) => {
        setActiveTab(value);
        setNis("");
        setResult(null);
    };

    return (
        <div className="flex min-h-screen items-center justify-center bg-background p-4 sm:p-8">
            <Card className="w-full max-w-xl shadow-sm">
                    <CardHeader className="space-y-3 border-b">
                        <div className="flex items-center gap-3">
                            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/15 text-primary">
                                <QrCode className="h-6 w-6" />
                            </span>
                            <div>
                                <CardTitle className="text-2xl font-semibold">Sistem Presensi</CardTitle>
                                <CardDescription className="text-sm">Scan QR atau masukkan NIS untuk mencatat kehadiran.</CardDescription>
                            </div>
                        </div>
                    </CardHeader>

                    <CardContent className="space-y-6">
                        <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
                            <TabsList className="grid w-full grid-cols-2 rounded-xl bg-muted p-1 shadow-inner">
                                <TabsTrigger value="scan" className="rounded-lg data-[state=active]:bg-background data-[state=active]:shadow">
                                    <Scan className="mr-2 h-4 w-4" />
                                    Scan QR
                                </TabsTrigger>
                                <TabsTrigger value="manual" className="rounded-lg data-[state=active]:bg-background data-[state=active]:shadow">
                                    <Keyboard className="mr-2 h-4 w-4" />
                                    Manual NIS
                                </TabsTrigger>
                            </TabsList>

                            <TabsContent value="scan" className="mt-6 space-y-4 focus-visible:outline-none focus-visible:ring-0">
                                <div className="flex items-start gap-4 rounded-2xl border border-primary/20 bg-primary/5 p-4 shadow-sm">
                                    <div className="relative mt-1 flex h-4 w-4 items-center justify-center">
                                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-500 opacity-60" />
                                        <span className="relative inline-flex h-3 w-3 rounded-full bg-green-500" />
                                    </div>
                                    <div className="space-y-1">
                                        <p className="text-sm font-semibold">Scanner siap</p>
                                        <p className="text-sm text-muted-foreground">Arahkan QR siswa ke pemindai. Input tersembunyi akan menangkap kode secara otomatis.</p>
                                    </div>
                                </div>

                                <Input
                                    ref={scanInputRef}
                                    type="text"
                                    value={nis}
                                    onChange={handleScanInputChange}
                                    onKeyDown={handleKeyDown}
                                    className="absolute left-0 top-0 h-px w-px opacity-0 pointer-events-none"
                                    disabled={loading}
                                    autoComplete="off"
                                    autoFocus
                                />

                                {loading && (
                                    <div className="flex items-center justify-center gap-2 rounded-xl border bg-muted/60 px-3 py-2 text-sm text-muted-foreground">
                                        <Loader2 className="h-4 w-4 animate-spin text-primary" />
                                        Memproses pemindaian...
                                    </div>
                                )}
                            </TabsContent>

                            <TabsContent value="manual" className="mt-6 space-y-4 focus-visible:outline-none focus-visible:ring-0">
                                <form onSubmit={handleManualSubmit} className="space-y-4">
                                    <div className="space-y-2">
                                        <Label htmlFor="nis-manual" className="text-sm font-semibold">Nomor Induk Siswa (NIS)</Label>
                                        <Input
                                            ref={manualInputRef}
                                            id="nis-manual"
                                            type="text"
                                            value={nis}
                                            onChange={handleManualInputChange}
                                            placeholder="Masukkan NIS"
                                            disabled={loading}
                                            autoComplete="off"
                                        />
                                        <p className="text-xs text-muted-foreground">Pastikan NIS sesuai data sekolah.</p>
                                    </div>
                                    <Button type="submit" className="w-full" disabled={loading || !nis.trim()}>
                                        {loading ? (
                                            <>
                                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                                Memproses...
                                            </>
                                        ) : (
                                            "Absen sekarang"
                                        )}
                                    </Button>
                                </form>
                            </TabsContent>
                        </Tabs>

                        {result && (
                            <Alert
                                variant={result.success ? "default" : "destructive"}
                                className={`animate-in fade-in slide-in-from-bottom-2 duration-300 rounded-xl border ${
                                    result.alreadyPresent ? "border-amber-400/60 text-amber-900 dark:text-amber-100 bg-amber-50 dark:bg-amber-900/20 [&>svg]:text-amber-600" : ""
                                }`}
                            >
                                {result.success ? (
                                    <CheckCircle className="h-4 w-4" />
                                ) : result.alreadyPresent ? (
                                    <AlertCircle className="h-4 w-4" />
                                ) : (
                                    <XCircle className="h-4 w-4" />
                                )}
                                <AlertTitle>{result.message}</AlertTitle>
                                {(result.success || result.alreadyPresent) && result.data && (
                                    <AlertDescription className="mt-3 space-y-2 text-sm">
                                        <div className="flex justify-between">
                                            <span className="text-muted-foreground">Nama</span>
                                            <span className="font-semibold">{result.data.userName}</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-muted-foreground">Kelas</span>
                                            <span>{result.data.className}</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-muted-foreground">Status</span>
                                            <span className={result.success ? "text-green-600 dark:text-green-400" : "text-amber-600 dark:text-amber-400"}>
                                                {result.data.status}
                                            </span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-muted-foreground">Tanggal</span>
                                            <span>{result.data.date}</span>
                                        </div>
                                    </AlertDescription>
                                )}
                            </Alert>
                        )}
                    </CardContent>

                    <CardFooter className="border-t py-4 text-center text-xs text-muted-foreground">
                        <div className="w-full">© 2026 Sistem Absensi Siswa</div>
                    </CardFooter>
                </Card>
        </div>
    );
}
