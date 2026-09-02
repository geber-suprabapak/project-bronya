# Glossary

## Astra

**Meaning:** The only documented authority for student lookup and attendance writes.
**Evidence:** `README.md`.

## Attendance action

**Meaning:** A Bronya server action that obtains a Logto token and calls Astra.
**Evidence:** `src/app/(main)/presensi/actions.ts`.

## Kiosk operator

**Meaning:** Privileged Logto-authenticated user allowed to operate Bronya.
**Not:** A student or local database account.
**Evidence:** `README.md`, `src/lib/logto/claims.ts`.

## NIS

**Meaning:** Student identification number used by kiosk lookup logic.
**Not:** A credential.
**Evidence:** `src/app/(main)/presensi/actions.ts`.
