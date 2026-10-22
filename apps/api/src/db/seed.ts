import { getDb, openDb, setDb } from "./client.js";
import { newId } from "../lib/ids.js";
import { hashPassword } from "../lib/password.js";

/** Fake seed only — never production people or passwords. */
export const SEED_PASSWORD = "Wolf-Fake-Pass-1!";

type SeedUser = {
  email: string;
  displayName: string;
  companies: Array<{ code: string; apps: string[] }>;
};

const SEED_USERS: SeedUser[] = [
  {
    email: "owner@wolf.example",
    displayName: "Fake Owner",
    companies: [
      { code: "BZG", apps: ["portal", "finance"] },
      { code: "AMG", apps: ["portal", "finance"] },
      { code: "GGV", apps: ["portal", "finance"] },
    ],
  },
  {
    email: "finance.amg@wolf.example",
    displayName: "Fake AMG Finance",
    companies: [{ code: "AMG", apps: ["portal", "finance"] }],
  },
  {
    email: "staff.amg@wolf.example",
    displayName: "Fake AMG Staff",
    companies: [{ code: "AMG", apps: ["portal"] }],
  },
  {
    email: "finance.bzg@wolf.example",
    displayName: "Fake BZG Finance",
    companies: [{ code: "BZG", apps: ["portal", "finance"] }],
  },
  {
    email: "exec@wolf.example",
    displayName: "Fake Group Exec",
    companies: [
      { code: "BZG", apps: ["portal", "finance"] },
      { code: "AMG", apps: ["portal", "finance"] },
    ],
  },
  {
    email: "developer@wolf.example",
    displayName: "Fake Developer",
    companies: [{ code: "BZG", apps: ["portal"] }],
  },
];

const COMPANIES = [
  { code: "BZG", name: "BZG Holdings (fake)", timezone: "Asia/Jakarta", currency: "IDR" },
  { code: "AMG", name: "AMG Hospitality (fake)", timezone: "Asia/Jakarta", currency: "IDR" },
  { code: "GGV", name: "GGV Media (fake)", timezone: "Asia/Jakarta", currency: "IDR" },
];

export function seedDatabase(db = getDb()): void {
  const now = new Date().toISOString();
  const passwordHash = hashPassword(SEED_PASSWORD);

  const insertCompany = db.prepare(
    `INSERT OR IGNORE INTO companies (id, code, name, timezone, currency_default, status)
     VALUES (@id, @code, @name, @timezone, @currency, 'active')`,
  );
  const companyIds = new Map<string, string>();
  for (const c of COMPANIES) {
    const existing = db.prepare(`SELECT id FROM companies WHERE code = ?`).get(c.code) as
      | { id: string }
      | undefined;
    if (existing) {
      companyIds.set(c.code, existing.id);
      continue;
    }
    const id = newId();
    insertCompany.run({
      id,
      code: c.code,
      name: c.name,
      timezone: c.timezone,
      currency: c.currency,
    });
    companyIds.set(c.code, id);
  }

  const insertUser = db.prepare(
    `INSERT OR IGNORE INTO users (id, email, display_name, status, password_hash, created_at)
     VALUES (@id, @email, @displayName, 'active', @passwordHash, @createdAt)`,
  );
  const insertIdentity = db.prepare(
    `INSERT OR IGNORE INTO auth_identities (id, user_id, provider, subject)
     VALUES (@id, @userId, 'password', @subject)`,
  );
  const insertEmployment = db.prepare(
    `INSERT OR IGNORE INTO employments (id, user_id, company_id, employee_no, status, valid_from, valid_to)
     VALUES (@id, @userId, @companyId, @employeeNo, 'active', @validFrom, NULL)`,
  );
  const insertEntitlement = db.prepare(
    `INSERT OR IGNORE INTO app_entitlements (id, user_id, company_id, app_key)
     VALUES (@id, @userId, @companyId, @appKey)`,
  );

  let n = 1;
  for (const u of SEED_USERS) {
    const existing = db.prepare(`SELECT id FROM users WHERE email = ?`).get(u.email) as
      | { id: string }
      | undefined;
    const userId = existing?.id ?? newId();
    if (!existing) {
      insertUser.run({
        id: userId,
        email: u.email,
        displayName: u.displayName,
        passwordHash,
        createdAt: now,
      });
      insertIdentity.run({ id: newId(), userId, subject: u.email });
    }
    for (const membership of u.companies) {
      const companyId = companyIds.get(membership.code)!;
      insertEmployment.run({
        id: newId(),
        userId,
        companyId,
        employeeNo: `E-${String(n).padStart(4, "0")}`,
        validFrom: "2024-01-01",
      });
      for (const app of membership.apps) {
        insertEntitlement.run({ id: newId(), userId, companyId, appKey: app });
      }
      if (membership.apps.includes("finance")) {
        seedFinanceGrants(db, userId, companyId);
      } else {
        seedStaffGrants(db, userId, companyId);
      }
    }
    n += 1;
  }
}

const FINANCE_PERMS = [
  "finance.health.read",
  "finance.session.read",
  "finance.admin.read",
  "finance.admin.write",
  "finance.admin.access",
  "finance.admin.mock",
  "finance.accounts.read",
  "finance.accounts.write",
  "finance.journal.read",
  "finance.journal.write",
  "finance.journal.approve",
  "finance.report.read",
  "finance.report.export",
  "finance.controls.read",
  "finance.ops.read",
  "finance.ops.write",
  "finance.config.read",
  "finance.config.write",
  "finance.inventory.read",
  "finance.inventory.write",
  "finance.arap.read",
  "finance.arap.write",
  "finance.service_charge.read",
  "finance.service_charge.write",
  "finance.owner_pool.read",
  "finance.owner_pool.write",
  "finance.tax.read",
  "finance.tax.write",
  "finance.petty_cash.read",
  "finance.petty_cash.write",
];

const STAFF_PERMS = ["finance.health.read", "finance.session.read"];

function ensurePermissions(db: ReturnType<typeof getDb>): void {
  const insert = db.prepare(
    `INSERT OR IGNORE INTO permissions (key, description, default_classification)
     VALUES (?, ?, 2)`,
  );
  for (const key of FINANCE_PERMS) {
    insert.run(key, key);
  }
}

function seedFinanceGrants(
  db: ReturnType<typeof getDb>,
  userId: string,
  companyId: string,
): void {
  ensurePermissions(db);
  const insert = db.prepare(
    `INSERT INTO grants (id, user_id, role_id, permission_key, scope_type, scope_id, valid_from, valid_to, granted_by, reason, ticket_ref)
     VALUES (@id, @userId, NULL, @permissionKey, 'company', @companyId, '2024-01-01', NULL, 'seed', 'fake finance add-on', NULL)`,
  );
  for (const permissionKey of FINANCE_PERMS) {
    const exists = db
      .prepare(
        `SELECT 1 AS ok FROM grants WHERE user_id = ? AND permission_key = ? AND scope_id = ?`,
      )
      .get(userId, permissionKey, companyId);
    if (!exists) insert.run({ id: newId(), userId, permissionKey, companyId });
  }
}

function seedStaffGrants(
  db: ReturnType<typeof getDb>,
  userId: string,
  companyId: string,
): void {
  ensurePermissions(db);
  const insert = db.prepare(
    `INSERT INTO grants (id, user_id, role_id, permission_key, scope_type, scope_id, valid_from, valid_to, granted_by, reason, ticket_ref)
     VALUES (@id, @userId, NULL, @permissionKey, 'company', @companyId, '2024-01-01', NULL, 'seed', 'fake staff base', NULL)`,
  );
  for (const permissionKey of STAFF_PERMS) {
    const exists = db
      .prepare(
        `SELECT 1 AS ok FROM grants WHERE user_id = ? AND permission_key = ? AND scope_id = ?`,
      )
      .get(userId, permissionKey, companyId);
    if (!exists) insert.run({ id: newId(), userId, permissionKey, companyId });
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  setDb(openDb());
  seedDatabase();
  console.log("Seeded fake Wolf identity data.");
}
