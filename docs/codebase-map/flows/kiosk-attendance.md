# Kiosk Attendance

1. Logto routes establish a session and resolve an allowed kiosk role.
2. A server action obtains an access token for the configured resource.
3. It builds Astra URL/headers and calls Astra for student, schedule, and attendance behavior.
4. Bronya maps the result to the UI.

Missing configuration, invalid role, token failure, or Astra rejection stops the action; no local write substitutes for Astra.

**Evidence:** `src/app/(main)/presensi/actions.ts`, `src/lib/logto/claims.ts`, `README.md`, `tests/actions-contract-challenge.test.ts`.
