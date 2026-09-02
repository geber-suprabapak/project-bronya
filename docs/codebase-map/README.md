# Codebase Map

Project Bronya is the staff-operated attendance kiosk. It uses a server-side Logto session and forwards privileged kiosk actions to Astra; it has no local attendance-write fallback.

| Area | Read |
| --- | --- |
| Logto/Astra boundary | [Architecture overview](architecture/overview.md) |
| Kiosk flow | [Kiosk attendance](flows/kiosk-attendance.md) |
| Routes, actions, UI | [Modules](modules.md) |
| Rules | [Invariants](invariants.md) |
