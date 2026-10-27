# Invariants

## INV-BRONYA-001 — Astra is the attendance authority

**Rule:** Kiosk interactions do not create a direct PostgreSQL or local fallback attendance write.
**Evidence:** `README.md`, `src/app/(main)/presensi/actions.ts`.

## INV-BRONYA-002 — Kiosk use requires a privileged role

**Rule:** Student and unknown roles are not kiosk operators.
**Evidence:** `README.md`, `src/lib/logto/claims.ts`, `src/middleware.ts`.

## INV-BRONYA-003 — Fail closed on Astra rejection

**Rule:** An Astra error is not presented as a successful attendance action.
**Evidence:** `README.md`, `tests/actions-contract-challenge.test.ts`.

## INV-BRONYA-004 — Kiosk result timestamps use the school timezone

**Rule:** Check-in and repeated-scan results format the display date in Asia/Jakarta regardless of the server timezone, matching the WIB attendance day.
**Evidence:** `src/app/(main)/presensi/actions.ts`.

## INV-BRONYA-005 — Local runtime environments stay outside Docker builds

**Rule:** Docker build context excludes local environment files, dependencies and build output. Runtime credentials come from deployment configuration.
**Evidence:** `.dockerignore`, `Dockerfile`.
