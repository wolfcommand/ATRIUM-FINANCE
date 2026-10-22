# Finance permission inventory (Prompt 4)

HR deferred — no HR routes. Mapped from `INTEGRATION-AUDIT-finance.md` + live `server.ts` surface.

Applied without waiting for separate review per owner directive (continue until Finance-ready).

| Method | Path pattern | Permission key | Notes |
|---|---|---|---|
| GET | `/api/health` | `finance.health.read` | Unauthenticated health exempt in middleware |
| GET/POST | `/api/wolf/*` | `finance.session.read` | Handoff/session |
| GET | `/api/status`, `/api/sheets/*`, `/api/admin/settings` | `finance.admin.read` | |
| POST | `/api/admin/settings`, `/api/sheets/*`, `/api/integrations/*` | `finance.admin.write` | |
| * | `/api/admin/access-control*` | `finance.admin.access` | Includes switch-user (still dangerous; Prompt 5+ hardening) |
| * | `/api/admin/mock-data*` | `finance.admin.mock` | |
| GET | `/api/accounts*`, `/api/departments*` | `finance.accounts.read` | |
| POST/PUT/DELETE | `/api/accounts*`, POST `/api/departments*` | `finance.accounts.write` | |
| GET | `/api/journals*`, `/api/ledger*` | `finance.journal.read` | |
| POST/PUT/DELETE | `/api/journals*` | `finance.journal.write` | |
| POST | `/api/journals/*/approve`, `/post` | `finance.journal.approve` | |
| GET | `/api/trial-balance*`, `/api/dashboard*`, `/api/reports*` | `finance.report.read` | |
| POST | `/api/reports*` | `finance.report.export` | |
| GET | `/api/controls*` | `finance.controls.read` | |
| GET/POST | `/api/revenue*`, `/api/spending*` | `finance.ops.read` / `write` | |
| GET/POST | `/api/mapping*`, `/api/config*` | `finance.config.read` / `write` | |
| * | `/api/inventory*` | `finance.inventory.read` / `write` | |
| * | `/api/ar*`, `/api/ap*` | `finance.arap.read` / `write` | |
| * | `/api/service-charge*` | `finance.service_charge.read` / `write` | |
| * | `/api/owner-pool*` | `finance.owner_pool.read` / `write` | Confidential |
| * | `/api/tax*` | `finance.tax.read` / `write` | |
| * | `/api/petty-cash*` | `finance.petty_cash.read` / `write` | |

Any `/api/*` path that does not match a pattern is **denied** (`unguarded_route`).
