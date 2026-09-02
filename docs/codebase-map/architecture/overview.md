# Bronya Architecture

Bronya is a Next.js kiosk client. Logto routes establish server sessions and claims; kiosk pages invoke server actions. Those actions obtain the current access token, construct Astra headers, and call Astra for student/schedule/attendance behavior.

`DATABASE_URL` is retained for tooling compatibility, but the documented kiosk runtime does not write attendance directly to PostgreSQL. `/api/health` reports incomplete Logto/Astra configuration.

**Evidence:** `README.md`, `src/app/(main)/presensi/actions.ts`, `src/lib/logto/config.ts`, `src/app/api/health/route.ts`.
