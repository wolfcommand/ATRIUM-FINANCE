# D1 identity provider spike (Prompt 2)

## Requirements checked

| Requirement | Google Identity Platform | Self-hosted (this MVP) |
|---|---|---|
| Passkeys (WebAuthn) | Yes (with setup) | Planned — not required for Prompt 2 acceptance |
| TOTP MFA enforceable per group | Yes | Stub: `auth_level` on session; TOTP enrollment deferred |
| Server-side session revocation | Limited / custom | **Yes** — `sessions.revoked_at` |
| Time of last authentication | Via token claims / Admin SDK | **Yes** — `sessions.auth_time` |
| Admin API disable users / revoke sessions | Yes | **Yes** — user status + revoke endpoints |

## Decision

**No live GIP project credentials in this Cloud Agent / CI environment**, so a full GIP spike against a real tenant was not possible. Per playbook guidance, we adopted a **self-hosted Wolf identity** (scrypt password verify + server-side sessions + httpOnly cookie) that owns `users.id` (UUIDv7) and links providers via `auth_identities`.

Production target remains swappable: provider subjects map through `auth_identities` only. Revisit passkeys/TOTF enrollment before go-live; record as D1 in `docs/DECISIONS.md`.
