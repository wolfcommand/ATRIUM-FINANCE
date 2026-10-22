# Decisions log

## Prompt 1 — monorepo shell (Finance-only)

| Item | Decision |
|---|---|
| Platform repo | https://github.com/wolfcommand/ATRIUM-FINANCE (fork of Zaynn28/ATRIUM-FINANCE) |
| Finance source commit (pre-move HEAD) | `bad9d235d75d04f8c6d0edea12611ca97ee97376` |
| Upstream origin | https://github.com/Zaynn28/ATRIUM-FINANCE |
| How Finance entered the monorepo | In-repo `git mv` of the existing root app into `apps/finance` (not `git subtree add`, because this fork already *was* the Finance app). File history retained via `git log --follow`. |
| HR | Deferred. `apps/hr/README.md` placeholder only; no source commit. |
| Package manager | pnpm workspaces + Turborepo. Retired root `bun.lock` (audit noted Bun lock vs npm-style scripts mismatch). Dependency versions for Finance kept as-is unless install required a fix. |
| Datastore (open, D9-style) | Finance Level-2 keeps Google Sheets + JSON/`data/` file stores + in-memory Maps until an explicit Postgres migration phase. Do not migrate on Prompt 1. |
| Portal | Minimal Next.js App Router launcher only; no auth. Finance remains Vite + Express. |
| Shared packages | `@wolf/ui`, `@wolf/access`, `@wolf/contracts` are stubs only; Finance does not import them yet. |

### What Prompt 1 did not do

- No Finance business-logic, auth, or RBAC changes.
- No Wolf identity/sessions (Prompt 2), JWT handoff (Prompt 3), or `authorize()` wrapping (Prompt 4).
- No company_id / money / audit migrations (Prompt 5+).
- No HR import.

---

## Prompt 2 — identity and sessions

| Item | Decision |
|---|---|
| D1 Identity provider | **Self-hosted Wolf identity** (scrypt passwords + server-side `sessions` + httpOnly `wolf_session` cookie). Live Google Identity Platform spike not possible without tenant credentials in CI; platform still owns `users.id` (UUIDv7) and links providers via `auth_identities`. Passkeys/TOTP enrollment deferred before go-live; `auth_level` / `auth_time` fields exist for step-up later. |
| API service | New `apps/api` (Express) — Next.js portal does not open the DB. |
| Database for local/CI | SQLite via `better-sqlite3` at `apps/api/data/wolf.sqlite`. Production target remains Postgres (Cloud SQL) per architecture; migrate when hosting is ready. |
| Seed | 3 companies (BZG, AMG, GGV) + 6 fake users; password `Wolf-Fake-Pass-1!` (dev only). |
| Endpoints | `POST /v1/auth/login`, `POST /v1/auth/logout`, `POST /v1/auth/sessions/:id/revoke`, `GET /v1/me`. |
| Portal | Login page + launcher shows companies/apps from `/v1/me`; proxies `/v1/*` to API. |

### Changed

- Added `@wolf/api` with identity/org tables, seed, session cookie auth, tests.
- Portal login/logout and authenticated launcher.

### Not done

- Passkeys, TOTP enrollment UI, GIP Admin SDK.
- Postgres, Cloud Run deploy.
- JWT handoff to Finance (Prompt 3).

### Risks

- Password auth only — MFA not enforced yet (go-live gate).
- SQLite is not the prod datastore; schema must be ported to Postgres before shared environments.
- Cookie `Secure` only in production; local HTTP OK for fake data.


---

## Prompt 3 — signed handoff to Finance

| Item | Decision |
|---|---|
| Handoff token | EdDSA JWT, ~60s TTL, `aud=finance`, claims: user_id, session_id, company_id, auth_level, auth_time (no permissions) |
| JWKS | `GET /.well-known/jwks.json` |
| Finance entry | `POST /api/wolf/handoff` exchanges token for httpOnly `finance_wolf_session`; legacy login returns 410 |
| Session checks | Every `/api/*` (except health/handoff/session) re-checks Wolf session active |
| HR handoff | Deferred with HR |
| Gateway | Documented in `docs/gateway-finance.md` (IAP/private ingress; not hard-coded) |

### Changed
- API handoff + JWKS; portal `/open-finance`; Finance wolfAuth middleware; tests for expired/wrong aud/tampered/revoked.

### Not done
- HR handoff; production gateway wiring; MFA step-up on handoff.

### Risks
- Finance still has open business APIs once a Wolf session exists — Prompt 4 adds authorize().
- In-memory Finance sessions reset on process restart.

---

## Prompt 4 — shared authorize()

| Item | Decision |
|---|---|
| Guard | `@wolf/access` `authorize()` is the only decision function |
| Inventory | `docs/permission-inventory.md` — applied immediately (owner: continue without pauses) |
| Finance wiring | After Wolf session middleware, `requireAuthorized` matches route → permission → grants from API |
| Unguarded `/api/*` | HTTP 403 `unguarded_route` |
| HR | Deferred — no HR inventory |

### Changed
- packages/access implementation + tests; API grants tables/seed; Finance middleware + auth matrix tests.

### Not done
- Removing dangerous admin routes (switch-user/mock reset) — still permission-gated only.
- Step-up enforcement beyond obligation flags.

### Risks
- Grant cache TTL 30s — revocation lag until cache expiry or process restart.
- Pattern-based route map may miss newly added Finance routes (CI unguarded test helps).

---

## Prompt 5 — Finance adjustments (journals)

| Item | Decision |
|---|---|
| Company scoping | Journal headers carry `company_id` from Wolf session; list/get/mutate filter by session company. Cross-company reads return 404. |
| Backfill mapping | Pre-scoped / seed journals → `WOLF_FINANCE_DEFAULT_COMPANY_ID` or `seed-amg` (AMG Finance provenance). Owner can remap later. |
| Money | Journal lines store `debit_minor` / `credit_minor` (integer) + `currency`; major `debit`/`credit` derived for UI/Sheets. Helpers in `server/money.ts`. |
| Reconcile | `pnpm --filter @wolf/finance reconcile:money` + `GET /api/admin/reconcile-journal-money`; counts/totals before=after on idempotent backfill. |
| Audit | Append-only in-memory `auditLog` for journal create/update/delete/approve/export. No update/delete API. |
| Approvals | `approvalPolicy.ts` — default `finance.journal.approve` = single finance_controller step (prior hard-coded behavior). Snapshot stored on approve. |
| RLS | Not applied — Finance still in-memory/Sheets (D9). App-layer isolation only until Postgres absorb. |
| Other modules | Inventory/AR/etc. amounts not migrated in this prompt; journals only. |

### Changed
- Company-scoped journal APIs; money helpers + reconcile; audit events; approval policy; tests in `src/prompt5.test.ts`.

### Not done
- Full-table `company_id` on inventory/tax/owner-pool/etc.
- Postgres RLS; migrating non-journal money fields.
- HR Prompt 6.

### Risks
- Internal `createJournal` callers without session still stamp `defaultCompanyId`.
- Audit log is process-local (lost on restart) until core audit module lands in `apps/api`.

---

## Prompt 7 — events (partial; no HR publishers)

| Item | Decision |
|---|---|
| Outbox | `outbox_events` in Wolf API SQLite; `enqueueOutboxEvent` + `relayOnce` in-process emulator |
| Transport | In-memory handler bus in dev/CI (Pub/Sub later) |
| Finance consumer | Idempotent `finance.employee_ref` + `finance_consumer_processed`; DLQ `dead_letter_events` |
| HR publishers | **Deferred** with Prompt 6 — use `POST /v1/events/inject` (fake) for tests |
| Event types | `employee.created`, `employee.updated`, `employment.ended` (v1 minimal payload) |

### Changed
- Schema + outbox/relay + finance employee_ref consumer + DLQ + tests.

### Not done
- Real HR publishers; Pub/Sub; admin DLQ UI; replacing any Finance→HR table reads (none found in Finance Level-2).

### Risks
- Inject endpoint must stay disabled in prod (`WOLF_ALLOW_EVENT_INJECT=false`).
- createApp registers consumer globally — tests must reset handlers between cases.

---

## Prompt 8 — admin screens + employee CSV import

| Item | Decision |
|---|---|
| Admin auth | Seeded `owner@wolf.example` or `portal.admin` grant |
| Screens | Portal `/admin` + API `/v1/admin/*` (users, memberships, grants, access requests, audit, import) |
| Import | Preview-then-commit CSV; all-or-nothing; stubbed mailer (in-memory outbox) |
| Audit | `audit_events` table; every admin mutate + import writes a row |
| Source | Reused WIP from `cursor/wolf-prompt-8-admin-50d0` @ c5c0d50, rebased onto Prompt 7 |

### Changed
- Admin routes/modules/tests; portal admin UI; schema for audit + access_requests.

### Not done
- MFA for admins; production SMTP; rich grant UI beyond JSON tables.

### Risks
- Owner email hard-coded for admin gate — replace with role before go-live.
- Portal admin SSR fetches need API reachable from portal server.

---

## Phase 4 — Approvals + Finance expense core (2026-10-22)

| Item | Decision |
|---|---|
| Policy home | Wolf API `approval_policies` / steps / requests (not Finance in-memory) |
| Snapshot | `chain_snapshot` JSON frozen on submit; policy edits = new version + `valid_to` on old |
| First subject | `finance.expense` in API + portal `/approvals` inbox |
| Finance Level-2 journals | Keep existing `apps/finance` approvalPolicy until absorb; core is the target |
| Events | Final expense approval publishes `expense.approved` via outbox |

### Not done
- Full absorb of Finance journals into core engine; rich policy editor UI; leave/request types on same engine.

---

## Phase 3 — HR complete + Academy (2026-10-22)

| Item | Decision |
|---|---|
| Academy placement | API `/v1/academy/*` + portal `/academy` (no separate app yet) |
| Base access | Every employment gets `academy` entitlement + learner grants (§5.1) |
| Onboarding link | `employee.created` → academy onboarding consumer enrolls company-assigned courses |
| Catalog | Seeded Welcome + Security courses; company-wide assignments, 14-day due |
| Content Machine | Still coming_soon |

### Not done
- Certificates, rich course authoring UI, separate Next academy app, role/department assignment rules.

---

## Phase 2 — Shell and admin (2026-10-22)

| Item | Decision |
|---|---|
| Design system | Minimal `@wolf/ui` tokens + Shell/Button/AppTile (Fraunces + Source Sans 3) — expand later |
| Locked apps | Launcher shows Finance/HR locked with **Request access**; Academy/Content = coming soon |
| Self-serve requests | `POST /v1/access/requests` (`app.finance` \| `app.hr`) for employed staff via `identity.me.read` |
| Approve side effects | `app.*` approval inserts `app_entitlements` + minimal company grants |
| Admin link | Shown only when `capabilities.portalAdmin` from grants (still enforced by authorize) |

### Not done
- Full shadcn/Figma design-system package; MFA on admin; rich membership editor.

---

## Phase 1 — Trust core gaps (2026-10-22)

| Item | Decision |
|---|---|
| Admin gate | `authorize("portal.admin")` only — removed owner-email bypass |
| Events / employee-refs | Require `integration.events.*` / `finance.employee_ref.read` via `requirePermission` |
| Identity routes | `/v1/me`, session revoke, handoff, grants use `identity.*` permissions |
| grants_version | Column on `users`; bumped on grant/membership/access-request approve |
| Route registry | `apps/api/src/routes/registry.ts` + `assertRoutesGuarded` in CI (`auth-matrix.test.ts`) |
| RLS | `migrations/002_trust_core_rls.sql` enables FORCE RLS + `company_isolation` on company-scoped tables |
| D1–D8 | Unchanged defaults from architecture §13 (self-hosted identity until GIP spike) |

### Changed
- Shared `requirePermission` / `grantsVersion`; admin/events/auth/access/handoff/HR health+meta hardened; seed base identity + portal.admin grants; auth matrix tests.

### Not done
- Live MFA/passkeys; Postgres cutover + SET LOCAL company_ids in API request path; step-up enforcement beyond obligations.

### Risks
- `/v1/sessions/:id/active` remains intentionally `public` (opaque session-id capability for Finance/HR).
- SQLite has no RLS — company isolation is app-layer until Cloud SQL.

---

## Greenfield HRIS + multi-tenant ops + GCP target (2026-10-22)

| Item | Decision |
|---|---|
| HR placement | Greenfield `apps/hr` (Vite+Express :3200) + domain APIs in `apps/api` `/v1/hr/*` — no legacy HRIS import |
| Companies | BZG, AMG, GGV all get Portal→Finance and Portal→HR when entitled; handoff JWT carries `company_id` |
| Ops config | Leave types, payroll rates, service charge mode (`equal`\|`by_level`\|`off`) + level weights + pools are **per company** — never global hard-codes |
| Seed divergence | AMG=`by_level`, BZG=`equal`, GGV=`off` defaults; editable via API/UI |
| Employee ID | `ENTITY+YY+MM+SEQ` using that company’s code |
| Events | Real publishers on create/update/offboard → outbox → `finance.employee_ref` |
| Local DB | SQLite via `WOLF_DB_PATH` **dev-only** |
| Production DB | Cloud SQL PostgreSQL (`DATABASE_URL`); SQL in `apps/api/migrations/`; no Firestore as SoR |
| Hosting | Cloud Run + Cloud DNS custom domains; host-only cookies; Secret Manager for secrets |
| Sessions | Host-only httpOnly cookies (`wolf_session`, `finance_wolf_session`, `hr_wolf_session`); production cookie host = Cloud DNS name |

### Changed
- HR schema/modules/routes/tests; portal `/open-hr`; ecosystem scripts; `.env.example`; Postgres migration stub; Project runbook.

### Not done
- Live Cloud SQL cutover + `pg` driver in API runtime; payslip PDF binary; full attendance/AI modules.
