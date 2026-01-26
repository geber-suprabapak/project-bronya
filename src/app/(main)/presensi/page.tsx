"use client";

import {
  AlertCircle,
  Calendar,
  CheckCheck,
  CheckCircle,
  CornerDownLeft,
  GraduationCap,
  History,
  Keyboard,
  Loader2,
  QrCode,
  Scan,
  User,
  XCircle,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Kbd } from "@/components/ui/kbd";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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

type LogEntry = {
  result: AbsenceResult;
  timestamp: number;
};

export default function IndexPage() {
  const [nis, setNis] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AbsenceResult | null>(null);
  const [activeTab, setActiveTab] = useState("scan");
  const [recentLogs, setRecentLogs] = useState<LogEntry[]>([]);

  // Refs for inputs
  const scanInputRef = useRef<HTMLInputElement>(null);
  const manualInputRef = useRef<HTMLInputElement>(null);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  const isScanMode = activeTab === "scan";

  // Reusable function to focus the correct input based on mode
  const focusInputForMode = useCallback((mode: string) => {
    setTimeout(() => {
      if (mode === "manual" && manualInputRef.current) {
        manualInputRef.current.focus();
      } else if (mode === "scan" && scanInputRef.current) {
        scanInputRef.current.focus();
      }
    }, 50);
  }, []);

  // Auto-focus logic - input stays focused even when popup is shown
  useEffect(() => {
    if (!loading) {
      if (isScanMode && scanInputRef.current) {
        scanInputRef.current.focus();
      } else if (!isScanMode && manualInputRef.current) {
        manualInputRef.current.focus();
      }
    }
  }, [loading, isScanMode]);

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

  // Auto-clear result after 1.5 seconds (popup still allows input)
  useEffect(() => {
    if (result) {
      const timer = setTimeout(() => {
        setResult(null);
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [result]);

  // Cleanup debounce
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, []);

  const processAbsence = useCallback(
    async (nisValue: string) => {
      if (!nisValue.trim() || loading) return;

      setLoading(true);
      setResult(null);

      try {
        const response = await checkNisAndCreateAbsence(nisValue.trim());
        setResult(response);
        setNis("");

        // Add to recent logs if successful or already present (has meaningful data)
        if ((response.success || response.alreadyPresent) && response.data) {
          const logEntry: LogEntry = {
            result: response,
            timestamp: Date.now(),
          };
          setRecentLogs((prev) => [logEntry, ...prev].slice(0, 5));
        }
      } catch (_error) {
        setResult({
          success: false,
          message: "Terjadi kesalahan saat memproses data",
        });
        setNis("");
      } finally {
        setLoading(false);
      }
    },
    [loading],
  );

  const handleScanInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setNis(value);

    if (value.trim()) {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = setTimeout(() => {
        processAbsence(value);
      }, 50);
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

  // Global Tab key handler for mode switching
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Tab") {
        e.preventDefault(); // Prevent default focus navigation
        const newMode = activeTab === "scan" ? "manual" : "scan";
        setActiveTab(newMode);
        setNis(""); // Clear input when switching
        setResult(null); // Clear result when switching
        focusInputForMode(newMode);
      }
    };

    window.addEventListener("keydown", handleGlobalKeyDown);
    return () => window.removeEventListener("keydown", handleGlobalKeyDown);
  }, [activeTab, focusInputForMode]);

  const handleTabChange = (value: string) => {
    setActiveTab(value);
    setNis("");
    setResult(null);
    focusInputForMode(value);
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4 sm:p-6 lg:p-8">
      <div className="flex w-full max-w-[90rem] flex-col gap-6 lg:flex-row lg:items-start justify-center">
        {/* Main Scanner Card */}
        <Card className="w-full max-w-2xl">
          <CardHeader className="border-b">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <QrCode className="h-6 w-6" />
              </div>
              <div className="grid gap-1">
                <CardTitle className="text-2xl">Skanida Apps</CardTitle>
                <CardDescription>
                  Scan QR atau masukkan NIS untuk mencatat kehadiran.
                </CardDescription>
              </div>
            </div>
          </CardHeader>

          <CardContent className="relative">
            {/* Result Popup Overlay - appears on top, doesn't block input */}
            {result && (
              <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/80 backdrop-blur-sm rounded-lg animate-in fade-in duration-200">
                <Card className="w-full mx-4 shadow-lg border-2">
                  <CardHeader className="pb-3">
                    <div className="flex items-center gap-3">
                      {result.success ? (
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-green-500/10">
                          <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400" />
                        </div>
                      ) : result.alreadyPresent ? (
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-500/10">
                          <AlertCircle className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                        </div>
                      ) : (
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-destructive/10">
                          <XCircle className="h-5 w-5 text-destructive" />
                        </div>
                      )}
                      <div className="grid gap-1">
                        <CardTitle
                          className={
                            result.alreadyPresent
                              ? "text-amber-700 dark:text-amber-300"
                              : result.success
                                ? "text-green-700 dark:text-green-300"
                                : "text-destructive"
                          }
                        >
                          {result.message}
                        </CardTitle>
                      </div>
                    </div>
                  </CardHeader>

                  {(result.success || result.alreadyPresent) && result.data && (
                    <CardContent className="grid gap-2 pt-0">
                      <Separator />
                      <div className="grid gap-2 pt-2">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2 text-muted-foreground">
                            <User className="h-4 w-4" />
                            <span className="text-sm">Nama</span>
                          </div>
                          <span className="text-sm font-medium">
                            {result.data.userName}
                          </span>
                        </div>

                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2 text-muted-foreground">
                            <GraduationCap className="h-4 w-4" />
                            <span className="text-sm">Kelas</span>
                          </div>
                          <span className="text-sm font-medium">
                            {result.data.className}
                          </span>
                        </div>

                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2 text-muted-foreground">
                            <CheckCheck className="h-4 w-4" />
                            <span className="text-sm">Status</span>
                          </div>
                          <Badge
                            variant={result.success ? "default" : "secondary"}
                            className={
                              result.success
                                ? "bg-green-500/15 text-green-700 hover:bg-green-500/20 dark:text-green-400"
                                : "bg-amber-500/15 text-amber-700 hover:bg-amber-500/20 dark:text-amber-400"
                            }
                          >
                            {result.data.status}
                          </Badge>
                        </div>

                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2 text-muted-foreground">
                            <Calendar className="h-4 w-4" />
                            <span className="text-sm">Tanggal</span>
                          </div>
                          <span className="text-sm font-medium">
                            {result.data.date}
                          </span>
                        </div>
                      </div>
                    </CardContent>
                  )}
                </Card>
              </div>
            )}

            {/* Main Content - always visible and accepts input */}
            <Tabs
              value={activeTab}
              onValueChange={handleTabChange}
              className="space-y-4"
            >
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="scan">
                  <Scan className="mr-2 h-4 w-4" />
                  Scan QR
                </TabsTrigger>
                <TabsTrigger value="manual">
                  <Keyboard className="mr-2 h-4 w-4" />
                  Manual NIS
                </TabsTrigger>
              </TabsList>

              <div className="flex justify-center mt-2">
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  Tekan <Kbd><span className="text-xs">↹</span> Tab</Kbd> untuk ganti mode
                </p>
              </div>

              <div className="mt-4">
                <TabsContent
                  value="scan"
                  className="mt-0 space-y-4 focus-visible:ring-0"
                >
                  <div className="flex items-start gap-3 rounded-lg border bg-muted/50 p-4">
                    <div className="relative mt-0.5 flex h-3 w-3 items-center justify-center">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-500 opacity-75" />
                      <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-green-500" />
                    </div>
                    <div className="grid gap-0.5">
                      <p className="text-sm font-medium leading-none">Scanner siap</p>
                      <p className="text-sm text-muted-foreground">
                        Gunakan scanner dan arahkan ke barcode di kartu pelajar.
                      </p>
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
                    <div className="flex items-center justify-center gap-2 rounded-lg border bg-muted/50 p-4">
                      <Loader2 className="h-4 w-4 animate-spin text-primary" />
                      <span className="text-sm text-muted-foreground">
                        Memproses pemindaian...
                      </span>
                    </div>
                  )}
                </TabsContent>

                <TabsContent
                  value="manual"
                  className="mt-0 space-y-4 focus-visible:ring-0"
                >
                  <form onSubmit={handleManualSubmit} className="grid gap-4">
                    <div className="grid gap-2">
                      <Label htmlFor="nis-manual">
                        Nomor Induk Siswa (NIS)
                      </Label>
                      <Input
                        ref={manualInputRef}
                        id="nis-manual"
                        type="text"
                        value={nis}
                        onChange={handleManualInputChange}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && !loading && nis.trim()) {
                            e.preventDefault();
                            processAbsence(nis);
                          }
                        }}
                        placeholder="Contoh: 17706"
                        disabled={loading}
                        autoComplete="off"
                      />
                      <p className="text-sm text-muted-foreground">
                        Masukkan NIS siswa sesuai dengan data yang terdaftar
                        di sistem.
                      </p>
                    </div>
                    <Button
                      type="submit"
                      className="w-full"
                      disabled={loading || !nis.trim()}
                    >
                      {loading ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Memproses...
                        </>
                      ) : (
                        <>
                          <CheckCheck className="mr-2 h-4 w-4" />
                          Presensi Sekarang
                          <Kbd className="ml-auto">
                            <CornerDownLeft className="size-3" />
                          </Kbd>
                        </>
                      )}
                    </Button>
                  </form>
                </TabsContent>
              </div>
            </Tabs>
          </CardContent>

          <CardFooter className="border-t justify-center">
            <p className="text-xs text-muted-foreground">
              © {new Date().getFullYear()} Edusoft Development | Lunara Labs
            </p>
          </CardFooter>
        </Card>

        {/* Recent Logs Card */}
        <Card className="w-full lg:w-96 h-[600px]">
          <CardHeader className="border-b flex-shrink-0">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <History className="h-5 w-5" />
              </div>
              <div className="grid gap-1">
                <CardTitle>Log Kehadiran</CardTitle>
                <CardDescription>5 Presensi Terakhir</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="flex-1 overflow-hidden p-0">
            <ScrollArea className="h-full">
              {recentLogs.length > 0 ? (
                <div className="divide-y">
                  {recentLogs.map((logEntry, index) => (
                    <div
                      key={logEntry.timestamp}
                      className={`grid gap-1.5 px-6 py-4 transition-colors hover:bg-muted/50 ${index === 0 ? "bg-muted/30" : ""
                        }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-medium text-sm truncate">
                          {logEntry.result.data?.userName}
                        </span>
                        <span className="text-xs font-mono text-muted-foreground shrink-0">
                          {new Date(logEntry.timestamp).toLocaleTimeString("id-ID", {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                      </div>
                      <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
                        <span className="truncate">{logEntry.result.data?.className}</span>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="font-mono">{logEntry.result.data?.nis}</span>
                          <Badge
                            variant={logEntry.result.success ? "default" : "secondary"}
                            className={
                              logEntry.result.success
                                ? "bg-green-500/15 text-green-700 hover:bg-green-500/20 dark:text-green-400"
                                : "bg-amber-500/15 text-amber-700 hover:bg-amber-500/20 dark:text-amber-400"
                            }
                          >
                            {logEntry.result.data?.status}
                          </Badge>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
                    <History className="h-6 w-6 text-muted-foreground" />
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Belum ada data presensi yang tercatat sesi ini.
                  </p>
                </div>
              )}
            </ScrollArea>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
