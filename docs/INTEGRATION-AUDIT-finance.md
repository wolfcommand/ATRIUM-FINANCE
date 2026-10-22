# INTEGRATION-AUDIT — AMG Finance (ATRIUM-FINANCE)

**Source repo:** https://github.com/Zaynn28/ATRIUM-FINANCE  
**Default branch:** `main`  
**HEAD commit SHA inspected:** `bad9d235d75d04f8c6d0edea12611ca97ee97376`  
**Inspection method:** read-only clone of the public URL plus GitHub MCP listing (owner `Zaynn28`, repo `ATRIUM-FINANCE`). No changes were made to that repository.

**Location note:** This audit lives in Project Context (`docs/INTEGRATION-AUDIT-finance.md`) because wolfcommand cannot yet push to a fork of the source repo. Observations below use only fake/generated demo shapes already present in the public tree; no production data was used. Secret **names** only — never values.

---

## 1. Stack

| Item | Finding | Evidence |
|---|---|---|
| Language | TypeScript (~5.8) | `package.json`, `tsconfig.json` |
| Frontend | React 19 SPA via Vite 6 | `package.json`, `vite.config.ts`, `src/main.tsx`, `src/App.tsx` |
| Backend | Express 4 on Node, same process as Vite in dev | `server.ts`, script `dev`: `tsx server.ts` |
| Package manager | npm-style scripts; lockfile is **Bun** (`bun.lock`) | `package.json`, `bun.lock` |
| UI / CSS | Tailwind CSS 4 (`@tailwindcss/vite`), Lucide icons, Motion | `package.json`, `src/index.css` |
| Build | `vite build` + `esbuild` bundle of `server.ts` → `dist/server.cjs` | `package.json` `build` / `start` |
| Deploy / hosting hints | AI Studio / Cloud Run oriented (`APP_URL`, applet `metadata.json`, Firebase applet config). No Dockerfile, no `.github/` CI | `.env.example`, `metadata.json`, `firebase-applet-config.json` |
| Other deps | `firebase`, `googleapis` (Sheets), `nodemailer`, `jspdf` / `xlsx`, `@google/genai` (declared, **no call sites found**) | `package.json`, repo-wide search |

Rough module surface: hotel ERP covering GL/journals, revenue/spending, inventory, AR/AP, tax, petty cash, staff service-charge trust, and apartment owner-pool distribution (`metadata.json`, `src/components/**`).

---

## 2. Authentication

**How users “log in”**

1. **Corporate email + password** against an in-memory user registry (`POST /api/auth/verify-user` in `server.ts`). Password check is a **plain string compare** to `SystemUser.password` when `isGoogleOAuth` is false.
2. **Optional Google popup** via Firebase Auth client (`src/services/firebase.ts`, `src/components/auth/LoginScreen.tsx`), then the same verify endpoint with `isGoogleOAuth: true` (password skipped; email must already be registered).

**Session / token handling**

- Browser gate: `localStorage` keys `amg_auth_session` (= `"active"`) and `amg_auth_email` (`src/App.tsx`).
- Server “current user”: mutable `store.currentUserId` set on verify / switch-user (`server/store.ts`). **No session cookie, JWT, or Authorization header** on subsequent API calls.
- Sign-out only clears localStorage (`handleSignOut` in `src/App.tsx`); does not revoke anything server-side.
- MFA / passkeys / password-reset flows: **none** found.
- Firebase Auth is used only for the Google popup path; Firestore is initialized (`getFirestore`) but **no application collection reads/writes** were found under `src/` beyond that init.

**Places the code reads the “current user”**

| Location | What it reads |
|---|---|
| `src/App.tsx` | `localStorage` auth flag; `accessControl.currentUserId` → `users` / `roles` |
| `src/components/auth/LoginScreen.tsx` | Calls `api.verifyUser`; optional Firebase `signInWithPopup` |
| `src/components/Navbar.tsx` | Displays / switches user (props from App) |
| `src/components/administration/UserAccessManager.tsx` | Admin CRUD of users/roles via API |
| `server.ts` `/api/auth/verify-user` | Matches email in `store.users` |
| `server.ts` `/api/admin/access-control/switch-user` | `store.setCurrentUser(userId)` with **no caller auth** |
| `server/store.ts` | `currentUserId`, `getAccessControlState()`, seeded users |

**Secret names involved (values not printed):** `GEMINI_API_KEY`, `APP_URL`, `GOOGLE_PROJECT_ID`, `GOOGLE_SERVICE_ACCOUNT_EMAIL`, `GOOGLE_PRIVATE_KEY`, `GOOGLE_SPREADSHEET_ID`, `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASS` (`.env.example`). Client Firebase config fields live in committed `firebase-applet-config.json` (project/app identifiers — treat as public client config, still not reproduced here).

---

## 3. Users and roles

**Model** (`src/types.ts`, seeded in `server/store.ts` `initDefaultAccessControl`):

- `SystemUser`: `id`, `name`, `email`, `roleId`, optional `password`, `departmentCode`, `status` (`active` \| `suspended` \| `invited`), optional `customPermissionsOverride`.
- `UserRoleDefinition`: module-pillar permissions — for each `PrimaryNavPillar`, flags `canView` / `canCreate` / `canEdit` / `canApprove` / `canDelete` / `canExport`.
- Seeded system roles (ids): `role-financial-controller`, `role-general-accountant`, `role-front-office-cashier`, `role-ap-purchasing`, `role-general-manager-owner`, `role-external-auditor`.
- Seeded demo users live in `server/store.ts` (emails like `@atriumhotel.com` plus one Gmail controller); **passwords are stored as plaintext fields in source** (values omitted here).

**Where enforced**

| Layer | Enforcement |
|---|---|
| Frontend | Pillar visibility: `currentRole.permissions[activePillar].canView` in `src/App.tsx`. Navbar can hide modules. This is **UI-only**. |
| API (`server.ts`) | **None.** Every `/api/*` route inspected accepts unauthenticated callers. No shared `authorize()`, no role checks on mutate/approve/post/export/admin/reset. |
| Firestore rules | If ever used: any signed-in user may read **and write** `/users/{userId}` and `/roles/{roleId}` (`firestore.rules`) — deny-by-default is not applied. |

**Route inventory (authorization check = none unless noted)**

Representative groups from `server.ts` (≈150 Express handlers; all unauthenticated):

- Health / status: `GET /api/health`, `GET /api/status`, `GET /api/sheets/diagnostics`
- Auth / RBAC admin: `POST /api/auth/verify-user` (login), `GET/POST/DELETE` under `/api/admin/access-control/*` including `switch-user`, user/role CRUD, reset
- Mock data: `GET/POST /api/admin/mock-data/*` (status, reset, seed-demo)
- GL / journals / reports: `/api/accounts`, `/api/departments`, `/api/journals*`, `/api/ledger`, `/api/trial-balance`, `/api/dashboard`, `/api/reports/*`, `/api/controls/exceptions`
- Ops: `/api/revenue`, `/api/spending`, `/api/mapping`, `/api/config/reports*`
- Inventory: `/api/inventory/**` (items, PO, requisitions, receiving, counts, adjustments, reports)
- AR/AP: `/api/ar/*`, `/api/ap/*`
- Service charge: `/api/service-charge/**`
- Owner pool + email: `/api/owner-pool/**`
- Tax: `/api/tax/**`
- Petty cash: `/api/petty-cash/**`
- Integrations: `POST /api/integrations/pms-audit`, `POST /api/sheets/init`

**Conclusion for Wolf:** permissions today are not server-authoritative. Mapping to Wolf permission keys (e.g. `finance.expense.approve`) requires a full inventory + wrapping every route (playbook Prompt 4).

---

## 4. Data store

**Primary pattern:** process-local in-memory `Map` / arrays in store classes, optionally mirrored to **Google Sheets**, with several modules persisted as **JSON files under `data/`**.

| Store | Path | Purpose |
|---|---|---|
| Accounting core | `server/store.ts` (+ Sheets tabs via `server/sheets.ts`) | Chart of accounts, departments, journal headers/lines, revenue & spending txs, mapping + report config, system settings, users/roles |
| Inventory | `server/inventoryStore.ts` → `data/inventory.json` | Categories, storerooms, items, movements, requisitions, POs, receipts, counts, adjustments |
| Service charge | `server/serviceChargeStore.ts` → `data/service_charge.json` | Employees (incl. bank fields), collections, distribution cycles |
| Owner pool | `server/ownerPoolStore.ts` → `data/owner_pool.json` | Units/owners, rule config/history, batches, stays |
| Owner email | `server/ownerEmailStore.ts` → `data/owner_email_store.json` | SMTP-oriented email config, drafts, dispatch logs |
| Tax | `server/taxStore.ts` | Tax rules, obligations, period close (in-memory; persistence details in that file) |
| AR/AP | `server/arapStore.ts` | Receivable/payable aging items & settlements |
| Petty cash | `server/pettyCashStore.ts` → `data/petty_cash.json` | Float config, vouchers, replenishment claims |
| Firestore (planned/partial) | `firebase-blueprint.json`, `firestore.rules` | Blueprint entities `UserProfile` / `RoleDefinition` only — **not the live ledger** |
| Migration tool | **None** (no Drizzle/Prisma/Flyway; JSON overwrite + Sheets sync) | — |

**Google Sheets tabs** (`REQUIRED_TABS` in `server/sheets.ts`): `chart_of_accounts`, `departments`, `journal_header`, `journal_line`, `revenue_transactions`, `spending_transactions`.

**Sensitive / money-bearing collections (examples)**

- Money: journal lines (debit/credit), revenue/spending amounts, inventory costs & PO totals, tax obligations, petty cash, service-charge pools/payouts, owner-pool room revenue and net distributions.
- Personal / payment data: service-charge `bank_account_number` / `bank_name`; owner-pool `owner_name`, `owner_email`, `owner_phone`, purchase prices; email dispatch recipient lists.
- Credentials: plaintext passwords on `SystemUser` in memory/source seeds; SMTP and Google service-account env vars.

**Alignment with Wolf:** architecture defaults to Postgres + RLS. This app is Sheets/JSON/in-memory — keep datastore for Level-2 wrap; plan migration as a later phase (playbook D9-style decision).

---

## 5. Multi-company support

**No tenant / `company_id` field** on accounting or module records.

What exists instead:

- Single-property settings: `store.systemSettings.property_name`, `room_count`, `base_currency`, etc. (`server/store.ts`).
- Hotel **departments** (`department_code`) — operational, not legal-entity tenancy.
- “AMG” in owner-pool config means **operator revenue share %** (`amg_allocation_pct`), not a Wolf company workspace.
- Report toolbar includes a display option label like “GGV (Multi-Property)” (`src/components/reports/UniversalReportToolbar.tsx`) — presentation only; not a data partition.

**Tables / collections that would need `company_id` for Wolf isolation** (non-exhaustive; essentially **all** company-scoped finance data):

- Sheets-backed: chart of accounts, departments, journal_header, journal_line, revenue_transactions, spending_transactions  
- In-memory/settings: mapping config, report config, system settings, users/roles (or migrate users to Wolf identity)  
- `data/inventory.json` entities  
- `data/service_charge.json` entities  
- `data/owner_pool.json` / `owner_email_store.json` entities  
- `data/petty_cash.json` entities  
- Tax / ARAP store entities  

Until then, Level-2 wrap **cannot** safely host BZG + AMG + GGV in one instance without network isolation or separate deployments per company.

---

## 6. Money and time

**Money**

- Stored as JavaScript `number` (IEEE float) on nearly all amount fields (`src/types.ts`: `amount`, `debit`, `credit`, `tax_amount`, `total_amount`, etc.).
- Rounding often via `Math.round(x * 100) / 100` (e.g. inventory PO tax in `server/inventoryStore.ts`, owner-pool allocations in `server/ownerPoolStore.ts`) — still not integer minor units.
- Currency: global `systemSettings.base_currency` default `'IDR'` and report formatting `currency_code: 'IDR'` / symbol `Rp` (`src/types.ts` `DEFAULT_MASTER_REPORT_CONFIG`). **No per-row currency code** on journal lines or transactions.
- Does **not** meet Wolf rule: integer minor units + ISO currency on every amount.

**Time**

- Business dates: `YYYY-MM-DD` strings (`journal_date`, transaction `date`, hire dates, stay dates).
- Periods: `YYYY-MM` strings.
- Event timestamps: ISO strings from `new Date().toISOString()` in stores (UTC “Z” form when produced that way).
- No first-class `timezone` / `timestamptz` column; company timezone not modeled.
- Period lock: `systemSettings.period_lock_date` string compared in store logic.

---

## 7. Audit trail

**Not a Wolf-style append-only audit log.**

What exists:

| Mechanism | What it is | Path |
|---|---|---|
| Journal workflow fields | `created_by`, `approved_by`, `posted_at`, `reversal_of` on headers | `src/types.ts`, `server/store.ts` |
| Controls & Audit UI | Computed **integrity exceptions** (unmapped accounts, drafts, imbalances) — not actor/action history | `src/components/ControlsAuditView.tsx`, `store.getControlExceptions` |
| Owner email dispatches | Delivery log entries (`dispatches` in `data/owner_email_store.json`) | `server/ownerEmailStore.ts` |
| Owner-pool rule history | Config snapshots / “temporal immutability” notes for posted batches | `server/ownerPoolStore.ts`, UI copy in `PoolPolicyConfigView.tsx` |
| Marketing copy | “Immutable Audit Logs” footer text | `src/App.tsx` |

Missing vs Wolf §4.2 `audit.events`: actor user id, session id, company id, action, resource, outcome, redacted changes, INSERT-only table, coverage of sensitive reads/exports.

---

## 8. External services

| Service | Role | Secret / config names |
|---|---|---|
| Firebase Auth (Google Identity) | Optional Google sign-in popup | Client config in `firebase-applet-config.json`; Auth domain / OAuth client id fields |
| Google Sheets API | Optional system-of-record mirror for core ledgers | `GOOGLE_PROJECT_ID`, `GOOGLE_SERVICE_ACCOUNT_EMAIL`, `GOOGLE_PRIVATE_KEY`, `GOOGLE_SPREADSHEET_ID` |
| SMTP via Nodemailer | Owner-pool distribution emails | `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASS` |
| Gemini (`@google/genai`) | Declared + `GEMINI_API_KEY` in `.env.example`; **no runtime usage found** in `.ts`/`.tsx` | `GEMINI_API_KEY` |
| Camera (browser) | Barcode scanner permission request | `metadata.json` `requestFramePermissions: ["camera"]` |

No payment gateway or dedicated object-storage SDK found; exports are client-side PDF/Excel/CSV (`jspdf`, `xlsx`, `src/utils/reportExport.ts`).

---

## 9. Frontend

| Topic | Detail |
|---|---|
| Framework | React 19 + TypeScript, Vite |
| Routing | **No React Router** — pillar/sub-tab state in `src/App.tsx` |
| UI | Tailwind 4, Lucide, Motion; custom hotel ERP screens under `src/components/**` |
| API access | Thin `fetch('/api/...')` client in `src/services/api.ts` (same origin; Vite middleware in dev via `server.ts`) |
| Auth UI | `src/components/auth/LoginScreen.tsx` |
| State | Local React state + localStorage session flag; loads masters via `refreshAll()` |
| Design system | Standalone Atrium branding (`AtriumLogo`); not Wolf/shadcn packages |

Frontend never talks to Sheets/Firestore for ledger data in the inspected code paths — it always goes through Express.

---

## 10. Tests

| Item | Finding |
|---|---|
| What exists | `src/utils/reportExport.test.ts` — CSV/Excel/PDF export formatting via Node’s `node:test` |
| How to run | `npm test` → `tsx --test src/utils/reportExport.test.ts` (`package.json`) |
| Lint / types | `npm run lint` → `tsc --noEmit` |
| Coverage | Roughly **export utilities only**; no API, auth, RBAC, money, or isolation tests |
| CI | No `.github/workflows` in the repo at inspected HEAD |

---

## 11. Risks

Ordered by severity for Wolf Level-2 readiness:

1. **Unauthenticated finance API surface** — any network client can read/write ledgers, approve/post journals, reset mock data, change RBAC, send owner emails (`server.ts`). Critical before any shared hosting.
2. **UI-only RBAC** — pillar `canView` in `src/App.tsx` is not security; contradicts Wolf “hiding UI is never security.”
3. **Trivial client session** — `localStorage` flag bypasses login screen without proving identity to the server.
4. **Plaintext passwords in source/seed data** — `password` fields on `SystemUser` in `server/store.ts`; verify endpoint returns full `user` object (may include password) to the client.
5. **Impersonation endpoint** — `POST /api/admin/access-control/switch-user` sets global `currentUserId` with no auth.
6. **No multi-company isolation** — single shared dataset; cross-company leak risk if multiple Wolf companies share one deploy.
7. **Float money without per-row currency** — rounding/reporting risk vs Wolf money rules; bad for group consolidation later.
8. **Firestore rules (if activated)** — signed-in users can write roles/users (`firestore.rules`).
9. **Committed Firebase client config** + demo PII-shaped JSON under `data/` (fake hotel owners/staff with bank fields) — treat as sensitive demo, never promote to prod.
10. **Open admin/destructive routes** — mock-data reset/seed, Sheets init, period reopen, email blast endpoints.
11. **Google OAuth verify trust** — server trusts client-supplied `isGoogleOAuth` + email string without verifying a Firebase ID token server-side.
12. **Lockfile / runtime mismatch** — `bun.lock` present while scripts use `tsx`/`node`; environment drift risk.
13. **Unused Gemini dependency** — attack/surface noise if key is later injected.

---

## 12. Recommendation

**Fit: Level-2 Wrap first, then Absorb.**

Rationale: the product surface (USALI statements, inventory, service charge, owner pool) is large and already working as a modular Express + React app. Rewriting into Wolf `finance` Postgres modules (Absorb) is high effort and should follow a usable portal handoff. The playbook already recommends Wrap → Absorb for finance. **However, this app is not wrap-safe today** because APIs trust nobody and company boundaries do not exist — Wrap must include hard server auth and either per-company deployments or a `company_id` pass before real staff use.

**Suggested integration level sequence**

1. **Level 2 Wrap** behind Wolf portal (identity token + gateway-only ingress).  
2. Keep Sheets/JSON datastore initially (record as open decision alongside architecture D9).  
3. **Absorb** later: migrate ledgers to Postgres with integer money, RLS, append-only audit, shared `authorize()`.

**Specific changes required to run safely behind Wolf login**

| # | Change | Rough effort |
|---|---|---|
| 1 | Remove/disable `LoginScreen` + `/api/auth/verify-user` password path; verify Wolf short-lived JWT (audience=`finance`) on entry; create local server session (httpOnly cookie); reject unverified requests | 2–4 days |
| 2 | Global Express middleware: session required on all `/api/*` except health; stop trusting `isGoogleOAuth` / localStorage | 1–2 days |
| 3 | Delete or hard-disable `switch-user`, mock-data reset/seed, and plaintext password fields; never return password hashes/secrets in JSON | 1 day |
| 4 | Map every route to Wolf permission keys; call shared `authorize()`; deny by default; CI matrix | 5–10 days (large route surface) |
| 5 | Company scoping: add `company_id` to all collections **or** run one isolated deploy per company until migration; enforce in every query | 5–15 days if in-app multi-tenant; 1–3 days if deploy-per-company interim |
| 6 | Gateway-only exposure (no public finance origin); strip Firebase direct auth from prod path | 1–2 days (infra) |
| 7 | Audit events on create/update/delete/approve/post/export + confidential reads | 3–5 days |
| 8 | Money plan: migrate amounts to integer minor units + currency (with reconciliation script on fake data) — can trail Wrap but before go-live | 5–10 days |
| 9 | Characterization tests for journals/owner-pool/service-charge before refactors | 3–5 days |

**Interim (pre-portal) if needed:** single-company AMG-only deploy behind VPN/IAP still requires items 2–3 immediately — the open API alone is disqualifying.

**Absorb later (not blocking Wrap):** move off Sheets/JSON to Postgres schemas `finance.*`, event consumers for HR employee refs, configurable approval policies replacing hard-coded journal approve chains, USALI report engine behind contracts package.

**Open decision to record for the platform:** Finance Level-2 keeps Google Sheets + JSON file stores until an explicit migration phase (architecture gap vs Postgres default).

---

*End of audit. Source SHA `bad9d235d75d04f8c6d0edea12611ca97ee97376` on `main`.*
