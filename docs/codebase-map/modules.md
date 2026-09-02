# Modules

## App routes and screens

**Purpose:** Render login, kiosk, and health surfaces through Next App Router.
**Entry points:** `src/app/`, `src/middleware.ts`.

## Kiosk attendance actions

**Purpose:** Resolve tokens, call Astra, and translate kiosk interactions into server actions.
**Entry point:** `src/app/(main)/presensi/actions.ts`.

## Logto integration

**Purpose:** Configure callbacks/session routes and derive permitted kiosk roles.
**Entry points:** `src/app/api/logto/`, `src/lib/logto/`.

## Components

**Purpose:** Present kiosk UI; not persist attendance directly.
**Entry points:** `src/components/`.
