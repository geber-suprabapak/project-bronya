"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";

const ERROR_MESSAGES = {
  forbidden_role: "Akun ini tidak memiliki role operator Bronya.",
  unauthorized: "Sesi Logto tidak valid atau telah berakhir.",
  session_unavailable: "Sesi Logto tidak tersedia. Silakan coba lagi.",
} as const;

export function LoginForm({
  className,
  ...props
}: React.ComponentProps<"div">) {
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    const errorCode = new URLSearchParams(window.location.search).get("error");
    if (errorCode && errorCode in ERROR_MESSAGES) {
      setError(ERROR_MESSAGES[errorCode as keyof typeof ERROR_MESSAGES]);
    }
  }, []);

  const handleLogtoSignIn = () => {
    setLoading(true);
    window.location.assign("/api/logto/sign-in");
  };

  return (
    <div
      className={cn("flex w-full max-w-sm flex-col gap-6", className)}
      {...props}
    >
      <Card>
        <CardHeader className="text-center">
          <CardTitle className="text-xl">Bronya Kiosk</CardTitle>
          <CardDescription>
            Masuk dengan akun operator Skanida untuk memakai terminal presensi.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button
            type="button"
            className="w-full"
            disabled={loading}
            onClick={handleLogtoSignIn}
          >
            {loading ? "Mengalihkan ke Logto..." : "Masuk dengan Logto"}
          </Button>
          {error && (
            <p
              className="rounded border border-red-200 bg-red-50 p-2 text-sm font-medium text-red-600"
              role="alert"
            >
              {error}
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
