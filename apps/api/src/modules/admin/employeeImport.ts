/**
 * CSV employee import with preview validation (Prompt 8).
 * Columns: full name, work email, company, department, job title,
 * direct manager, start date, employment type, add-ons.
 * All-or-nothing commit after a clean preview.
 */
import type { Db } from "../../db/client.js";
import { getDb } from "../../db/client.js";
import { newId } from "../../lib/ids.js";
import { hashPassword } from "../../lib/password.js";
import { writeAdminAudit } from "./audit.js";
import { sendMail } from "./mailer.js";

export type ImportRow = {
  line: number;
  fullName: string;
  workEmail: string;
  company: string;
  department: string;
  jobTitle: string;
  directManager: string;
  startDate: string;
  employmentType: string;
  addOns: string;
};

export type RowError = { line: number; field?: string; message: string };

export type PreviewResult = {
  rows: ImportRow[];
  errors: RowError[];
  ok: boolean;
};

const HEADER =
  "full name,work email,company,department,job title,direct manager,start date,employment type,add-ons";

function parseCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]!;
    if (inQuotes) {
      if (ch === '"' && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        cur += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      out.push(cur.trim());
      cur = "";
    } else {
      cur += ch;
    }
  }
  out.push(cur.trim());
  return out;
}

export function parseEmployeeCsv(csv: string): ImportRow[] {
  const lines = csv
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
  if (!lines.length) return [];
  const header = lines[0]!.toLowerCase().replace(/\s+/g, " ");
  const startIdx = header.includes("full name") && header.includes("work email") ? 1 : 0;
  const rows: ImportRow[] = [];
  for (let i = startIdx; i < lines.length; i++) {
    const cols = parseCsvLine(lines[i]!);
    rows.push({
      line: i + 1,
      fullName: cols[0] ?? "",
      workEmail: (cols[1] ?? "").toLowerCase(),
      company: (cols[2] ?? "").toUpperCase(),
      department: cols[3] ?? "",
      jobTitle: cols[4] ?? "",
      directManager: (cols[5] ?? "").toLowerCase(),
      startDate: cols[6] ?? "",
      employmentType: cols[7] ?? "",
      addOns: cols[8] ?? "",
    });
  }
  return rows;
}

function isIsoDate(s: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(s));
}

export function previewEmployeeImport(csv: string, db: Db = getDb()): PreviewResult {
  const rows = parseEmployeeCsv(csv);
  const errors: RowError[] = [];
  const emailsInFile = new Map<string, number>();

  const companies = new Map(
    (
      db.prepare(`SELECT id, code FROM companies`).all() as Array<{ id: string; code: string }>
    ).map((c) => [c.code.toUpperCase(), c.id]),
  );
  const usersByEmail = new Map(
    (
      db.prepare(`SELECT id, email FROM users`).all() as Array<{ id: string; email: string }>
    ).map((u) => [u.email.toLowerCase(), u.id]),
  );

  for (const row of rows) {
    if (!row.fullName) errors.push({ line: row.line, field: "full name", message: "full name required" });
    if (!row.workEmail || !row.workEmail.includes("@")) {
      errors.push({ line: row.line, field: "work email", message: "valid work email required" });
    } else {
      if (emailsInFile.has(row.workEmail)) {
        errors.push({
          line: row.line,
          field: "work email",
          message: `duplicate email in file (also line ${emailsInFile.get(row.workEmail)})`,
        });
      } else {
        emailsInFile.set(row.workEmail, row.line);
      }
      if (usersByEmail.has(row.workEmail)) {
        errors.push({ line: row.line, field: "work email", message: "email already registered" });
      }
    }
    if (!row.company || !companies.has(row.company)) {
      errors.push({
        line: row.line,
        field: "company",
        message: `unknown company '${row.company || "(empty)"}'`,
      });
    }
    if (!isIsoDate(row.startDate)) {
      errors.push({
        line: row.line,
        field: "start date",
        message: "start date must be YYYY-MM-DD",
      });
    }
    if (row.directManager) {
      const mgrOk =
        usersByEmail.has(row.directManager) ||
        [...emailsInFile.keys()].includes(row.directManager) ||
        rows.some((r) => r.workEmail === row.directManager && r.line !== row.line);
      // Manager may be another row in this file (forward or back ref)
      const inFile = rows.some((r) => r.workEmail === row.directManager);
      if (!usersByEmail.has(row.directManager) && !inFile) {
        errors.push({
          line: row.line,
          field: "direct manager",
          message: `unknown manager '${row.directManager}'`,
        });
      }
      void mgrOk;
    }
  }

  return { rows, errors, ok: errors.length === 0 && rows.length > 0 };
}

const BASE_STAFF_PERMS = ["finance.health.read", "finance.session.read"];

function grantBase(db: Db, userId: string, companyId: string): void {
  const insertPerm = db.prepare(
    `INSERT OR IGNORE INTO permissions (key, description, default_classification) VALUES (?, ?, 1)`,
  );
  for (const key of BASE_STAFF_PERMS) insertPerm.run(key, key);
  const insert = db.prepare(
    `INSERT INTO grants (id, user_id, role_id, permission_key, scope_type, scope_id, valid_from, valid_to, granted_by, reason, ticket_ref)
     VALUES (?, ?, NULL, ?, 'company', ?, date('now'), NULL, 'import', 'base staff on import', NULL)`,
  );
  for (const key of BASE_STAFF_PERMS) {
    const exists = db
      .prepare(
        `SELECT 1 AS ok FROM grants WHERE user_id = ? AND permission_key = ? AND scope_id = ?`,
      )
      .get(userId, key, companyId);
    if (!exists) insert.run(newId(), userId, key, companyId);
  }
}

export function commitEmployeeImport(
  csv: string,
  actorUserId: string,
  db: Db = getDb(),
): { imported: number; emails: string[] } {
  const preview = previewEmployeeImport(csv, db);
  if (!preview.ok) {
    throw new Error(`import_rejected:${preview.errors.length}_errors`);
  }

  const companies = new Map(
    (
      db.prepare(`SELECT id, code FROM companies`).all() as Array<{ id: string; code: string }>
    ).map((c) => [c.code.toUpperCase(), c.id]),
  );

  const passwordHash = hashPassword("Wolf-Fake-Pass-1!");
  const emails: string[] = [];

  const tx = db.transaction(() => {
    for (const row of preview.rows) {
      const companyId = companies.get(row.company)!;
      const userId = newId();
      db.prepare(
        `INSERT INTO users (id, email, display_name, status, password_hash, created_at)
         VALUES (?, ?, ?, 'active', ?, ?)`,
      ).run(userId, row.workEmail, row.fullName, passwordHash, new Date().toISOString());
      db.prepare(
        `INSERT INTO auth_identities (id, user_id, provider, subject) VALUES (?, ?, 'password', ?)`,
      ).run(newId(), userId, row.workEmail);
      db.prepare(
        `INSERT INTO employments (id, user_id, company_id, employee_no, status, valid_from, valid_to)
         VALUES (?, ?, ?, ?, 'active', ?, NULL)`,
      ).run(newId(), userId, companyId, null, row.startDate);
      db.prepare(
        `INSERT INTO app_entitlements (id, user_id, company_id, app_key) VALUES (?, ?, ?, 'portal')`,
      ).run(newId(), userId, companyId);
      grantBase(db, userId, companyId);
      sendMail(
        row.workEmail,
        "Activate your Wolf account",
        `Hello ${row.fullName},\n\nYour Wolf account is ready. Sign in at the portal with your work email.\n(This is a stubbed activation email — fake data only.)\n`,
      );
      emails.push(row.workEmail);
      writeAdminAudit(
        {
          actorUserId,
          action: "admin.employee.import_row",
          resourceType: "user",
          resourceId: userId,
          companyId,
          changes: { email: row.workEmail, company: row.company },
        },
        db,
      );
    }
    writeAdminAudit(
      {
        actorUserId,
        action: "admin.employee.import",
        resourceType: "import",
        resourceId: null,
        changes: { count: preview.rows.length, emails },
      },
      db,
    );
  });
  tx();

  return { imported: emails.length, emails };
}

export const EMPLOYEE_CSV_HEADER = HEADER;
