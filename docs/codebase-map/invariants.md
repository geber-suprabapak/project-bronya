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
