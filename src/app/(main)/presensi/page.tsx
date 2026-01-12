"use client";

import {
  AlertCircle,
  Calendar,
  CheckCheck,
  CheckCircle,
  GraduationCap,
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
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
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

  // Auto-clear result after 3 seconds
  useEffect(() => {
    if (result) {
      const timer = setTimeout(() => {
        setResult(null);
        // Refocus after clearing result
        if (isScanMode && scanInputRef.current) scanInputRef.current.focus();
        // If manual mode, user might be looking at result, maybe don't force focus?
        // But generally good to be ready for next input.
        if (!isScanMode && manualInputRef.current)
          manualInputRef.current.focus();
      }, 3000);
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

  const processAbsence = useCallback(
    async (nisValue: string) => {
      if (!nisValue.trim() || loading) return;

      setLoading(true);
      setResult(null);

      try {
        const response = await checkNisAndCreateAbsence(nisValue.trim());
        setResult(response);
        setNis("");
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
    <div className="flex min-h-screen items-center justify-center bg-background p-4 sm:p-6">
      <Card className="w-full max-w-2xl shadow-lg border-2 my-4 max-h-[calc(100vh-2rem)] flex flex-col">
        <CardHeader className="space-y-4 border-b pb-6">
          <div className="flex items-center gap-4">
            <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary ring-2 ring-primary/20">
              <QrCode className="h-7 w-7" />
            </span>
            <div className="flex-1">
              <CardTitle className="text-3xl font-bold tracking-tight">
                Skanida Apps
              </CardTitle>
              <CardDescription className="text-base mt-1.5">
                Scan QR atau masukkan NIS untuk mencatat kehadiran.
              </CardDescription>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-6 pt-6 overflow-y-auto flex-1">
          {!result ? (
            <Tabs
              value={activeTab}
              onValueChange={handleTabChange}
              className="w-full"
            >
              <TabsList className="flex w-full justify-between rounded-xl bg-muted p-1 shadow-inner">
                <TabsTrigger
                  value="scan"
                  className="flex-1 rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-md transition-all"
                >
                  <Scan className="mr-2 h-4 w-4" />
                  Scan QR
                </TabsTrigger>
                <TabsTrigger
                  value="manual"
                  className="flex-1 rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-md transition-all"
                >
                  <Keyboard className="mr-2 h-4 w-4" />
                  Manual NIS
                </TabsTrigger>
              </TabsList>

              <TabsContent
                value="scan"
                className="mt-6 space-y-4 focus-visible:outline-none focus-visible:ring-0"
              >
                <div className="flex items-start gap-4 rounded-2xl border border-primary/20 bg-primary/5 p-4 shadow-sm">
                  <div className="relative mt-1 flex h-4 w-4 items-center justify-center">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-500 opacity-60" />
                    <span className="relative inline-flex h-3 w-3 rounded-full bg-green-500" />
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm font-semibold">Scanner siap</p>
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
                  <div className="flex items-center justify-center gap-3 rounded-xl border-2 border-primary/20 bg-primary/5 px-4 py-3.5 shadow-sm">
                    <Loader2 className="h-5 w-5 animate-spin text-primary" />
                    <span className="text-sm font-medium text-primary">
                      Memproses pemindaian...
                    </span>
                  </div>
                )}
              </TabsContent>

              <TabsContent
                value="manual"
                className="mt-6 space-y-5 focus-visible:outline-none focus-visible:ring-0"
              >
                <form onSubmit={handleManualSubmit} className="space-y-5">
                  <div className="space-y-3">
                    <Label
                      htmlFor="nis-manual"
                      className="text-base font-semibold"
                    >
                      Nomor Induk Siswa (NIS)
                    </Label>
                    <Input
                      ref={manualInputRef}
                      id="nis-manual"
                      type="text"
                      value={nis}
                      onChange={handleManualInputChange}
                      placeholder="Contoh: 17706"
                      disabled={loading}
                      autoComplete="off"
                      className="h-11 text-base"
                    />
                    <p className="text-sm text-muted-foreground">
                      Masukkan NIS siswa sesuai dengan data yang terdaftar di
                      sistem.
                    </p>
                  </div>
                  <Button
                    type="submit"
                    className="w-full h-11 text-base font-semibold"
                    disabled={loading || !nis.trim()}
                    size="lg"
                  >
                    {loading ? (
                      <>
                        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                        Memproses...
                      </>
                    ) : (
                      <>
                        <CheckCheck className="mr-2 h-5 w-5" />
                        Absen Sekarang
                      </>
                    )}
                  </Button>
                </form>
              </TabsContent>
            </Tabs>
          ) : (
            /* Result Card - Replaces the input area */
            <div className="animate-in fade-in-50 zoom-in-95 duration-500">
              <Card
                className={`border-2 shadow-lg ${
                  result.alreadyPresent
                    ? "border-amber-400/60 bg-amber-50/50 dark:bg-amber-900/10"
                    : result.success
                      ? "border-green-500/60 bg-green-50/50 dark:bg-green-900/10"
                      : "border-destructive/60 bg-destructive/5"
                }`}
              >
                <CardHeader className="pb-4">
                  <div className="flex items-center gap-3">
                    {result.success ? (
                      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/30">
                        <CheckCircle className="h-6 w-6 text-green-600 dark:text-green-500" />
                      </div>
                    ) : result.alreadyPresent ? (
                      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-900/30">
                        <AlertCircle className="h-6 w-6 text-amber-600 dark:text-amber-500" />
                      </div>
                    ) : (
                      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10">
                        <XCircle className="h-6 w-6 text-destructive" />
                      </div>
                    )}
                    <CardTitle
                      className={`text-xl font-bold ${
                        result.alreadyPresent
                          ? "text-amber-900 dark:text-amber-100"
                          : result.success
                            ? "text-green-900 dark:text-green-100"
                            : "text-destructive"
                      }`}
                    >
                      {result.message}
                    </CardTitle>
                  </div>
                </CardHeader>

                {(result.success || result.alreadyPresent) && result.data && (
                  <CardContent className="space-y-4 pt-0">
                    <Separator />

                    <div className="grid gap-4">
                      <div className="flex items-center justify-between gap-4">
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <User className="h-5 w-5" />
                          <span className="text-sm font-medium">Nama</span>
                        </div>
                        <span className="text-base font-semibold">
                          {result.data.userName}
                        </span>
                      </div>

                      <div className="flex items-center justify-between gap-4">
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <GraduationCap className="h-5 w-5" />
                          <span className="text-sm font-medium">Kelas</span>
                        </div>
                        <span className="text-base font-semibold">
                          {result.data.className}
                        </span>
                      </div>

                      <div className="flex items-center justify-between gap-4">
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <CheckCheck className="h-5 w-5" />
                          <span className="text-sm font-medium">Status</span>
                        </div>
                        <Badge
                          variant={result.success ? "default" : "secondary"}
                          className={
                            result.success
                              ? "bg-green-600 hover:bg-green-700 dark:bg-green-500 text-base px-3 py-1"
                              : "bg-amber-600 hover:bg-amber-700 dark:bg-amber-500 text-base px-3 py-1"
                          }
                        >
                          {result.data.status}
                        </Badge>
                      </div>

                      <div className="flex items-center justify-between gap-4">
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <Calendar className="h-5 w-5" />
                          <span className="text-sm font-medium">Tanggal</span>
                        </div>
                        <span className="text-base font-semibold">
                          {result.data.date}
                        </span>
                      </div>
                    </div>
                  </CardContent>
                )}
              </Card>
            </div>
          )}
        </CardContent>

        <CardFooter className="border-t py-4 text-center text-xs text-muted-foreground flex-shrink-0">
          <div className="w-full">© {new Date().getFullYear()} Edusoft Development | Lunara Labs</div>
        </CardFooter>
      </Card>
    </div>
  );
}
