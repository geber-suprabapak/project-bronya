# Project Bronya

Bronya is Skanida's attendance-scanning kiosk. Logto owns operator login and
the server session; Astra is the only authority for student lookup and
attendance writes.

## Local development

```bash
cp .env.example .env
pnpm install
pnpm dev
```

Replace the Logto and Astra values in `.env` with the values for the local
stack. The default infra ports are Logto at `http://localhost:23001` and Astra
at `http://localhost:23000`. When Bronya runs in the same Docker network, use
the service URL `http://astra:3000` for Astra.

Register these exact URLs on the Logto application:

```text
${LOGTO_BASE_URL}/api/logto/callback
${LOGTO_POST_LOGOUT_REDIRECT_URI}
```

The Logto application must request the `LOGTO_RESOURCE` API resource and the
`mobile:access` and `admin:read` scopes. The existing `testadmin` user should
have the `school_admin` role and those two scopes.

## Authentication and Astra boundary

`/login` starts the Logto flow at `/api/logto/sign-in`; the callback stores the
server session, and `/api/logto/sign-out` clears it. Middleware and the main
route layout allow `platform_admin`, `school_admin`, `staff`, and `teacher`.
Students and unknown roles are sent back to `/login?error=forbidden_role`.

Every kiosk server action obtains the current session's Logto access token for
`LOGTO_RESOURCE` with `getAccessTokenRSC` and forwards it to Astra. Attendance
is fail-closed: if Astra rejects the operation, Bronya does not write a local
database fallback or report success.

## Configuration and checks

`.env.example` lists the complete runtime contract. Production requires
`ASTRA_API_URL`, the Logto endpoint/app credentials, a cookie secret of at
least 32 characters, `LOGTO_BASE_URL`, `LOGTO_RESOURCE`, and the post-logout
redirect URI. `DATABASE_URL` is retained only for schema/tooling compatibility;
the kiosk runtime does not write attendance directly to PostgreSQL.

Readiness is exposed at `/api/health`: it returns `503` and names missing
configuration until both the Astra and Logto boundaries are configured.

```bash
pnpm test
pnpm lint
pnpm exec tsc --noEmit
pnpm build
```
