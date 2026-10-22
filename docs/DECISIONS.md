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
