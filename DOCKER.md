# Bronya Docker Guide

## Build and run

```bash
docker build -t project-bronya .
docker run --rm -p 3000:3000 \
  -e NODE_ENV=production \
  -e ASTRA_API_URL="http://astra:3000" \
  -e LOGTO_ENDPOINT="https://auth.skanida.sch.id" \
  -e LOGTO_APP_ID="bronya-app" \
  -e LOGTO_APP_SECRET="replace-me" \
  -e LOGTO_COOKIE_SECRET="replace-with-a-random-secret-at-least-32-characters" \
  -e LOGTO_BASE_URL="https://kiosk.skanida.sch.id" \
  -e LOGTO_RESOURCE="https://api.skanida.sch.id" \
  -e LOGTO_POST_LOGOUT_REDIRECT_URI="https://kiosk.skanida.sch.id/login" \
  -e KIOSK_LATITUDE="-7.44998" \
  -e KIOSK_LONGITUDE="110.2236" \
  project-bronya
```

Use the Astra and Logto service DNS names when the container shares their
network. Do not configure an Astra device token: each server action obtains
the current authenticated Logto access token for `LOGTO_RESOURCE` and sends it
to Astra.

## Production environment contract

Required:

- `ASTRA_API_URL`
- `LOGTO_ENDPOINT`
- `LOGTO_APP_ID`
- `LOGTO_APP_SECRET`
- `LOGTO_COOKIE_SECRET` (at least 32 characters)
- `LOGTO_BASE_URL`
- `LOGTO_RESOURCE`
- `LOGTO_POST_LOGOUT_REDIRECT_URI`

`KIOSK_LATITUDE` and `KIOSK_LONGITUDE` default to the SMKN 2 Magelang kiosk
coordinates. `PORT` and `NODE_ENV` are standard process settings.
`DATABASE_URL` is retained only for schema/tooling compatibility; Bronya does
not write attendance directly to PostgreSQL.

Register these exact URLs in Logto:

```text
${LOGTO_BASE_URL}/api/logto/callback
${LOGTO_POST_LOGOUT_REDIRECT_URI}
```

The Logto API resource must grant Bronya `mobile:access` and `admin:read`.
`testadmin` is expected to have the `school_admin` role and both scopes.

`GET /api/health` returns `503` with the missing variable names until the
complete Astra/Logto contract is present. Attendance remains Astra-authority
only and fails closed when Astra rejects a lookup or write.

The image uses the existing standalone Next.js build and non-root runtime
configuration from the Dockerfile.
