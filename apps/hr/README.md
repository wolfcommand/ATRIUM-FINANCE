# apps/hr — ATRIUM HRIS (Wolf Level-2)

Greenfield HR app. Entry is **only** via Wolf portal handoff (`aud=hr`).

- Dev: `pnpm --filter @wolf/hr dev` (port **3200**)
- Proxies `/api/hr/*` → Wolf API `/v1/hr/*` with `X-Wolf-Session-Id` + company from handoff session
- Domain data and authorize() live in `apps/api`

See `/cursor/stores/self/docs/ecosystem-runbook.md`.
