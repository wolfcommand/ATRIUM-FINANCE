# Finance gateway access (Prompt 3)

Finance must not be exposed directly to the public internet in deployed environments.

## Required shape

1. Users authenticate at the **Wolf portal**.
2. Portal requests a short-lived handoff JWT (`aud=finance`, ~60s) from `POST /v1/handoff/token`.
3. Browser is redirected to Finance with `?wolf_token=…`; Finance verifies via JWKS (`/.well-known/jwks.json`), creates an httpOnly `finance_wolf_session`, and checks the Wolf session is still active on every `/api/*` call.
4. Legacy `POST /api/auth/verify-user` returns **410**.

## Deploy recommendation (not hard-coded)

- Put Finance behind the same edge/gateway as the portal (Cloud Run + Identity-Aware Proxy, Cloud Armor, or private ingress).
- Only allow origins that complete Wolf handoff; do not publish Finance as a standalone public login app.
- Environment knobs: `WOLF_API_ORIGIN`, `WOLF_JWKS_URL`, `VITE_PORTAL_URL`, `NEXT_PUBLIC_FINANCE_URL`.
