# Cursor playbook: bringing Finance and HR into Wolf Intelligence

Companion to `WOLF-ARCHITECTURE.md`. Use that file as the source of truth for decisions. This file tells you how to get your existing Finance and HR apps into the platform, in what order, and what to paste into Cursor.

---

## 1. The approach

Yes, you can integrate the existing apps without rewriting them. There are three levels, and each one builds on the one before.

| Level | What it means | Effort | Result |
|---|---|---|---|
| 1. Link | Apps stay separate. The portal just links to them | Hours | Looks connected, but separate logins and no shared permissions. Not enough |
| 2. Wrap | Apps keep running as they are, but sit behind the Wolf login. Wolf decides who can open them and passes a trusted identity and company to them. Their own login is removed | Days to weeks | One login, shared permissions, shared audit hooks |
| 3. Absorb | Code and data move into the Wolf API modules and database | Weeks to months, per app | Full architecture benefits |

Recommendation: do Level 2 first so you get something real and usable fast, then absorb one app at a time (finance first, then HR), as time allows.

Level 2 only protects your data if the existing apps respect company boundaries themselves. That is why Step 0 (the audit) comes first.

Rule for going live: nothing goes to real staff until all of the following are true:
1. The apps trust only the identity issued by Wolf, and have no login of their own.
2. Company data is scoped by company inside the apps.
3. The apps are reachable only through the portal gateway, never directly from the internet.

### If your existing apps use a different database

`WOLF-ARCHITECTURE.md` assumes Postgres for the main data. If your Finance or HR app currently uses something else (for example Firestore), do not migrate it on day one. Keep its datastore for Level 2, connect it through the portal and events, and plan the data migration as its own phase before the app is widely used. Add that decision to the open-decisions table (a new row, D9).

---

## 2. Step 0: audit each existing app

Run this prompt once inside each existing repo (Finance, then HR), in Cursor, before changing anything. Save the result as `INTEGRATION-AUDIT.md` in that repo, then bring both reports back to me.

```text
You are auditing this existing app so it can be integrated into a larger platform.
This is a READ-ONLY task. Do not modify, create, or delete any code or config, except for
creating one new file named INTEGRATION-AUDIT.md at the repo root.

Never print secret values (API keys, passwords, tokens, connection strings). List secret
names only.

Write INTEGRATION-AUDIT.md with these sections:

1. Stack: language, framework, versions, package manager, build and deploy method, hosting.
2. Authentication: how users log in, session or token handling, MFA, password reset,
   any third-party auth provider, and every place the code reads the current user.
3. Users and roles: how roles or permissions are modeled and where they are enforced
   (list every route, API endpoint, or server action and the check it uses, or say none).
4. Data store: database type, a list of every table or collection with a one-line purpose,
   which ones hold money, personal data, or other sensitive data, and any migration tool.
5. Multi-company support: does the data model have a company or tenant field? If not,
   list every table that would need one.
6. Money and time: how amounts are stored (type, currency, rounding) and how timestamps
   and time zones are stored.
7. Audit trail: is there any logging of who changed what? Where?
8. External services: email, storage, payment, third-party APIs (names only).
9. Frontend: framework, UI library, routing, how the frontend calls the backend.
10. Tests: what exists, how to run them, rough coverage.
11. Risks: security issues, hard-coded values, missing validation, anything unusual.
12. Recommendation: which integration level (wrap or absorb) fits, a list of the specific
    changes required to run safely behind a central login, and a rough effort estimate
    in days per change.

Be specific and cite file paths. If something is unclear, say so instead of guessing.
```

---

## 3. Prepare the Wolf monorepo for Cursor

Add these to the monorepo root before the first build prompt.

1. `docs/WOLF-ARCHITECTURE.md` (the architecture spec) and this playbook.
2. `.cursorignore` and `.cursorindexingignore` containing at least:

```text
.env
.env.*
*.pem
*.key
*.p12
service-account*.json
**/exports/**
**/real-data/**
*.dump
*.bak
```

3. The two rule files below, in `.cursor/rules/`.

### `.cursor/rules/wolf-core.mdc`

```text
---
description: Wolf Intelligence non-negotiables. Always apply.
alwaysApply: true
---

Read docs/WOLF-ARCHITECTURE.md sections 0 to 3 and 12 before any task. Never contradict them.
If a task conflicts with them, stop and ask.

Hard rules:
- Authorization happens on the server in one function, authorize(). No endpoint without it.
  No inline role checks. Hiding UI is never security.
- Every company-scoped table has company_id NOT NULL and an index. Use row-level security
  where the database supports it.
- Frontend code never connects to a database and never contains secrets.
- Money is integer minor units plus currency code. Time is UTC. IDs are UUIDv7 for new tables.
- Cross-module data goes through events or public service interfaces, not direct table access.
- Sensitive reads and every change write an audit event.
- Migrations are forward-only. Never edit one that has already been applied.
- Never log or print business data, personal data, or secrets.
- Use fake generated data in dev and staging. Never ask for or use production data.
- Do not touch anything related to the owner private domain from this repo.

Working style:
- For any non-trivial task, write a short plan first and wait for approval.
- Make small changes. One concern per commit.
- Add or update tests with every change. Permission changes must update the authorization test matrix.
- When something is unclear, add a note to docs/DECISIONS.md and use the documented default.
- At the end of each task, summarize what changed, what you did not do, and any remaining risks.
```

### `.cursor/rules/wolf-legacy-integration.mdc`

```text
---
description: Rules for integrating the existing Finance and HR apps
globs: apps/finance/**,apps/hr/**,packages/legacy-*/**
alwaysApply: false
---

These apps existed before the Wolf platform. Integrate them without breaking what works.

- Preserve existing behavior unless a task explicitly changes it. Add characterization tests
  before refactoring anything.
- Remove the app's own login. Trust only the signed identity issued by the Wolf portal,
  verified on every request. Never trust identity headers that could come from the internet.
- Deny by default. Every route, API endpoint, and server action must call the shared
  authorize() guard with a permission key such as finance.expense.read.
- Do not widen data access to make something work. If scoping by company breaks a screen,
  fix the query, not the rule.
- Data migrations must be reversible or backed up first, run against fake data in dev,
  and include a reconciliation check (counts and totals before and after).
- Do not rename or restructure existing tables beyond what the task needs.
- Keep the existing UI working. Restyle to the Wolf design system only in later, separate tasks.
```

---

## 4. Build order: prompts to paste into Cursor

Work in order. One prompt per branch. Review the diff, run the tests, merge, then move on. Each prompt starts with the same instruction so Cursor plans first.

### Prompt 1: monorepo, shell, and bringing the apps in

```text
Plan first and wait for my approval before changing anything.

Goal: set up the Wolf monorepo and bring the existing Finance and HR apps in unchanged.

Do:
1. Confirm the monorepo structure (pnpm workspaces, Turborepo): apps/portal, apps/finance,
   apps/hr, packages/ui, packages/access, packages/contracts.
2. Bring the existing Finance repo into apps/finance and the HR repo into apps/hr, preserving
   git history if possible (git subtree add), otherwise copy and note the source commit.
3. Make sure all three apps build and run locally with their current behavior.
4. Add a minimal portal app with a placeholder launcher page.
5. Add CI that builds and tests everything.

Do not change app logic. Acceptance: everything builds, existing tests still pass,
and docs/DECISIONS.md records the source repos and commits.
```

### Prompt 2: Wolf identity and sessions

```text
Plan first and wait for my approval before changing anything.

Goal: a working Wolf login and session in the portal, following docs/WOLF-ARCHITECTURE.md
sections 2 (gate D1), 4.2 (identity, org), and 6.

Do:
1. Implement the identity provider spike as the spec describes and report whether it meets
   the D1 requirements (passkeys, TOTP MFA, session revocation, last-auth time, admin API).
2. Create tables: users, auth_identities, sessions, companies, employments.
3. Implement login, logout, and a server-side session with an httpOnly cookie.
4. Implement GET /v1/me returning the user, their companies, and the apps they can open.
5. Seed fake data: 3 companies (BZG, AMG, GGV) and 6 fake users with different roles.

Acceptance: login works for a seeded user, /v1/me is correct for each user, sessions can be
revoked, and tests cover login, logout, and revoked sessions. No real data anywhere.
```

### Prompt 3: signed handoff to the legacy apps

```text
Plan first and wait for my approval before changing anything.

Goal: the portal sends users into Finance and HR with a trusted identity, and the apps no
longer have their own login. Follow the rules in wolf-legacy-integration.mdc.

Do:
1. In the portal, issue a short-lived (about 60 seconds) signed token per target app, with an
   audience claim for that app, containing user_id, session_id, company_id, auth_level,
   and auth_time. No permissions in the token.
2. Publish the signing keys through a JWKS endpoint.
3. In apps/finance and apps/hr, verify the token on entry, create a local session, and
   verify the session on every request. Remove or disable the old login screens and routes.
4. Make the apps reachable only through the gateway in deployed environments (describe the
   network or auth setup; do not hard-code anything environment-specific).
5. Add tests: expired token, wrong audience, tampered token, revoked Wolf session.

Acceptance: the only way into each app is through the portal, and all the tests above pass.
```

### Prompt 4: shared authorization in the legacy apps

```text
Plan first and wait for my approval before changing anything.

Goal: every route in Finance and HR passes through the shared authorize() guard.

Do:
1. Implement packages/access with authorize() as specified in docs/WOLF-ARCHITECTURE.md
   section 5.2, backed by roles, role_permissions, and grants tables, with the base
   staff grants plus add-on grants model from section 5.1.
2. Using the INTEGRATION-AUDIT.md files, produce an inventory table of every route and action
   in Finance and HR, mapped to a permission key (for example finance.expense.approve).
   Save it as docs/permission-inventory.md and wait for my review before applying it.
3. After I approve the inventory, wrap every route with the guard. Deny by default.
4. Generate an authorization test matrix (roles by routes by allow or deny) that runs in CI.

Acceptance: no route is reachable without a guard (add a test that fails if one is),
and the matrix passes.
```

### Prompt 5: Finance adjustments

```text
Plan first and wait for my approval before changing anything. Use only fake data.

Goal: make the Finance app safe to run in the platform. Work through these, one commit each:
1. Company scoping: add company_id to every finance table that needs it (use the audit),
   backfill using a mapping I will provide, enforce it in the data access layer, and add
   row-level security if the database supports it. Add tests that a user from one company
   cannot read or write another company's rows.
2. Money: if amounts are stored as floats or decimals without a currency, plan a migration
   to integer minor units plus a currency code. Include a reconciliation script (counts and
   totals before and after) and a rollback. Do not run anything against real data.
3. Audit: write an audit event for every finance create, update, delete, approval, and export,
   and for reads of confidential records.
4. Approvals: replace any hard-coded approval logic with a call into a configurable approval
   policy (docs/WOLF-ARCHITECTURE.md section 9.5), keeping current behavior as the default policy.

Acceptance: tests for isolation, reconciliation, audit events, and the default approval policy pass.
```

### Prompt 6: HR adjustments

```text
Plan first and wait for my approval before changing anything. Use only fake data.

Goal: make the HR app safe to run in the platform. Work through these, one commit each:
1. Company scoping: add company_id wherever needed and enforce it as in the Finance prompt.
2. Split personal data: move personal and sensitive fields off any global user record into
   employee_profiles scoped to one employment and one company. Tag fields with a
   classification (internal, confidential, restricted) and mask confidential and restricted
   fields in list views.
3. Audit: write an audit event for every change and for every read of confidential or
   restricted fields.
4. Offboarding: implement it as one transaction (end employment, expire grants, revoke
   sessions, escalate pending approvals), per docs/WOLF-ARCHITECTURE.md section 6.
5. Self-service: ensure a staff member can read and edit only their own allowed fields.

Acceptance: tests for isolation, masking, audit events, offboarding, and self-service pass.
```

### Prompt 7: events from HR to Finance

```text
Plan first and wait for my approval before changing anything.

Goal: connect HR and Finance through events instead of shared tables.

Do:
1. Add a transactional outbox table and a relay that publishes events (use a local
   in-memory or emulator transport in dev).
2. Publish employee.created, employment.ended, and employee.updated from HR with versioned,
   minimal payloads (IDs and the fields Finance genuinely needs).
3. In Finance, build a finance.employee_ref read model fed by those events with idempotent
   consumers, and a dead-letter table for failures.
4. Replace any place where Finance reads HR tables directly.

Acceptance: creating an employee in HR makes them appear in Finance within seconds, replays
cause no duplicates, and a failed event lands in the dead-letter table.
```

### Prompt 8: admin screens and employee import

```text
Plan first and wait for my approval before changing anything. Use only fake data.

Goal: let an admin manage people and permissions, and import the employee list.

Do:
1. Admin screens in the portal: users, company memberships, grants (with expiry and reason),
   and access requests. Every change writes an audit event.
2. A CSV import for employees with columns: full name, work email, company, department,
   job title, direct manager, start date, employment type, add-ons. Include a preview step
   that validates rows (duplicates, unknown manager, unknown company, bad dates) and shows
   errors before anything is saved. Import is all-or-nothing per file.
3. After import, each new person gets their base grants and an activation email (use a
   stubbed mailer in dev).

Acceptance: a fake CSV with deliberate errors is rejected with clear messages, a clean one imports,
and every import is recorded in the audit log.
```

After these, tasks, the owner dashboard, and the people view come next. I can write prompts for those once Prompts 1 to 8 are merged.

---

## 5. Adjustment checklists

### Finance app

- Remove the app's own login and trust the Wolf token only.
- Add `company_id` to every table, enforce it in queries, and add row-level security if possible.
- Store money as integer minor units with a currency code. Reconcile before and after.
- Store time in UTC.
- Audit every create, update, delete, approval, and export.
- Make approvals configurable through the shared policy, and snapshot the chain on each request.
- Make ledger entries append-only (corrections by reversing entries, never edits).
- Mask bank and payment details in lists. Require step-up authentication for exports and approvals above a limit.
- Keep the file store private, with signed URLs issued after an authorization check.

### HR app

- Remove the app's own login and trust the Wolf token only.
- Scope everything by company and employment.
- Move personal data to company-scoped employee profiles and classify sensitive fields.
- Mask sensitive fields in lists and log reads of them.
- Build offboarding as a single transaction.
- Give staff a self-service view limited to their own data.
- Keep documents private with signed URLs. Scan uploads.
- Publish employee events instead of letting other apps read HR tables.

---

## 6. Working with Cursor

- Use Plan mode (or ask for a plan first) and approve the plan before it writes code.
- One prompt per branch. Read every diff that touches authentication, authorization, migrations, or money. Let Cursor do the mechanical work, but do not skip review of security code.
- Ask for tests first on authorization and company isolation, then the implementation.
- Never paste production data, real names, bank details, keys, or tokens into Cursor. Use generated fake data.
- After each prompt, ask: "Summarize what changed, what you did not do, and what risks remain," and paste the answer into `docs/DECISIONS.md`.
- If Cursor wants to loosen a rule to make something work, treat that as a signal to stop and ask me or decide deliberately.

---

## 7. Go-live gates for Finance and HR

Do not give real staff access until every item is checked.

- [ ] All routes pass through the gateway and the guard. A test fails if one doesn't.
- [ ] Old logins are removed and the apps are not reachable directly.
- [ ] The authorization test matrix and company isolation tests pass in CI.
- [ ] Audit events appear for sensitive actions, and the audit table is append-only.
- [ ] MFA is enforced for finance and HR admins.
- [ ] Backups and a restore were tested.
- [ ] Staging ran on fake data only. Real data was imported once into production, through the import screen.
- [ ] A pilot with 3 to 5 trusted users ran for a week with no isolation issues.
- [ ] A rollback plan exists and was rehearsed.

---

## 8. What to bring back

1. Both `INTEGRATION-AUDIT.md` reports, with any secrets removed.
2. Which company each existing finance and HR record belongs to (even a simple rule like "all current data is BZG").
3. The owner's employee list when ready (send it through a secure channel).

With the audits I can turn this into an exact plan: the permission inventory, the data mapping, and an effort estimate for each app.
