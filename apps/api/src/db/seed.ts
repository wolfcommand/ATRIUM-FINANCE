import { getDb, openDb, setDb } from "./client.js";
import { newId } from "../lib/ids.js";
import { hashPassword } from "../lib/password.js";
import { seedLeaveTypesForCompany } from "../modules/hr/leave.js";
import { ensureDemoOrg } from "../modules/hr/org.js";
import { setPayrollPolicy } from "../modules/hr/payroll.js";

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
      { code: "BZG", apps: ["portal", "finance", "hr"] },
      { code: "AMG", apps: ["portal", "finance", "hr"] },
      { code: "GGV", apps: ["portal", "finance", "hr"] },
    ],
  },
  {
    email: "finance.amg@wolf.example",
    displayName: "Fake AMG Finance",
    companies: [{ code: "AMG", apps: ["portal", "finance"] }],
  },
  {
    email: "hr.amg@wolf.example",
    displayName: "Fake AMG HR Admin",
    companies: [{ code: "AMG", apps: ["portal", "hr"] }],
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
      { code: "BZG", apps: ["portal", "finance", "hr"] },
      { code: "AMG", apps: ["portal", "finance", "hr"] },
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
    ensurePermissions(db);
    for (const perm of IDENTITY_BASE_PERMS) {
      seedGroupGrant(db, userId, perm, "fake identity base");
    }
    if (u.email === "owner@wolf.example" || u.email === "developer@wolf.example") {
      for (const perm of INTEGRATION_PERMS) {
        seedGroupGrant(db, userId, perm, "fake portal admin / integration");
      }
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
      }
      if (membership.apps.includes("hr")) {
        seedHrGrants(db, userId, companyId);
      }
      // Portal-only staff (no finance/hr add-on) get minimal finance session grants for launcher health
      if (!membership.apps.includes("finance") && !membership.apps.includes("hr")) {
        seedStaffGrants(db, userId, companyId);
      }
    }
    n += 1;
  }

  // Per-company org + leave + divergent payroll/service-charge defaults (ops can edit later)
  const policyByCode: Record<string, Parameters<typeof setPayrollPolicy>[1]> = {
    AMG: {
      pph21_flat_rate: 0.05,
      service_charge_mode: "by_level",
      service_charge_default_pool_minor: 10_000_000_00,
      service_charge_level_weights: { L1: 1, L2: 1.2, L3: 1.5, L4: 1.8, L5: 2.2 },
    },
    BZG: {
      pph21_flat_rate: 0.06,
      service_charge_mode: "equal",
      service_charge_default_pool_minor: 5_000_000_00,
      service_charge_level_weights: { L1: 1, L2: 1, L3: 1, L4: 1, L5: 1 },
    },
    GGV: {
      pph21_flat_rate: 0.05,
      service_charge_mode: "off",
      service_charge_default_pool_minor: 0,
    },
  };
  for (const [code, companyId] of companyIds.entries()) {
    ensureDemoOrg(companyId, db);
    seedLeaveTypesForCompany(companyId, db);
    setPayrollPolicy(companyId, policyByCode[code] ?? {}, "seed");
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

/** Base identity grants for every seeded user (group scope). */
const IDENTITY_BASE_PERMS = [
  "identity.me.read",
  "identity.session.revoke",
  "identity.handoff.create",
];

/** Integration / ops grants for portal admins (group scope). */
const INTEGRATION_PERMS = [
  "integration.events.inject",
  "integration.events.relay",
  "integration.events.read",
  "finance.employee_ref.read",
  "portal.admin",
];

const HR_PERMS = [
  "hr.session.read",
  "hr.employee.read",
  "hr.employee.read_restricted",
  "hr.employee.write",
  "hr.employee.import",
  "hr.employee.offboard",
  "hr.leave.read",
  "hr.leave.request",
  "hr.leave.approve",
  "hr.leave.admin",
  "hr.payroll.read",
  "hr.payroll.write",
  "hr.payroll.calculate",
  "hr.payroll.approve",
  "hr.payroll.admin",
  "hr.self.read",
  "hr.self.write",
];

function ensurePermissions(db: ReturnType<typeof getDb>): void {
  const insert = db.prepare(
    `INSERT OR IGNORE INTO permissions (key, description, default_classification)
     VALUES (?, ?, 2)`,
  );
  for (const key of [
    ...FINANCE_PERMS,
    ...HR_PERMS,
    ...STAFF_PERMS,
    ...IDENTITY_BASE_PERMS,
    ...INTEGRATION_PERMS,
  ]) {
    insert.run(key, key);
  }
}

function seedGroupGrant(
  db: ReturnType<typeof getDb>,
  userId: string,
  permissionKey: string,
  reason: string,
): void {
  const exists = db
    .prepare(
      `SELECT 1 AS ok FROM grants WHERE user_id = ? AND permission_key = ? AND scope_type = 'group'`,
    )
    .get(userId, permissionKey);
  if (exists) return;
  db.prepare(
    `INSERT INTO grants (id, user_id, role_id, permission_key, scope_type, scope_id, valid_from, valid_to, granted_by, reason, ticket_ref)
     VALUES (?, ?, NULL, ?, 'group', NULL, '2024-01-01', NULL, 'seed', ?, NULL)`,
  ).run(newId(), userId, permissionKey, reason);
}

function seedHrGrants(
  db: ReturnType<typeof getDb>,
  userId: string,
  companyId: string,
): void {
  ensurePermissions(db);
  const insert = db.prepare(
    `INSERT INTO grants (id, user_id, role_id, permission_key, scope_type, scope_id, valid_from, valid_to, granted_by, reason, ticket_ref)
     VALUES (@id, @userId, NULL, @permissionKey, 'company', @companyId, '2024-01-01', NULL, 'seed', 'fake hr add-on', NULL)`,
  );
  for (const permissionKey of HR_PERMS) {
    const exists = db
      .prepare(
        `SELECT 1 AS ok FROM grants WHERE user_id = ? AND permission_key = ? AND scope_id = ?`,
      )
      .get(userId, permissionKey, companyId);
    if (!exists) insert.run({ id: newId(), userId, permissionKey, companyId });
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
