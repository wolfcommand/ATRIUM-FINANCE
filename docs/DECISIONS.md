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
