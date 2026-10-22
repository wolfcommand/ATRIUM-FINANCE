/**
 * Leave types (ID categories), balances, requests, approvals — configurable, not hard-coded.
 */
import type { Db } from "../../db/client.js";
import { getDb } from "../../db/client.js";
import { newId } from "../../lib/ids.js";
import { writeAdminAudit } from "../admin/audit.js";

/** Indonesian leave category codes — seeded as configurable master, not business rules. */
export const ID_LEAVE_CATEGORY_SEED = [
  { code: "ANNUAL", name: "Annual Leave", category: "annual", entitlement: 12 },
  { code: "SICK", name: "Sick Leave", category: "sick", entitlement: 0 },
  { code: "MATERNITY", name: "Maternity Leave", category: "maternity", entitlement: 90 },
  { code: "PATERNITY", name: "Paternity Leave", category: "paternity", entitlement: 2 },
  { code: "UNPAID", name: "Unpaid Leave", category: "unpaid", entitlement: 0 },
  { code: "SPECIAL", name: "Special Leave (ID)", category: "special_id", entitlement: 0 },
] as const;

export function seedLeaveTypesForCompany(companyId: string, db: Db = getDb()): void {
  const now = new Date().toISOString();
  const insert = db.prepare(
    `INSERT OR IGNORE INTO leave_types
      (id, company_id, code, name, category, default_entitlement, requires_attachment, requires_approval, is_paid, is_active, created_at)
     VALUES (?, ?, ?, ?, ?, ?, 0, 1, ?, 1, ?)`,
  );
  for (const t of ID_LEAVE_CATEGORY_SEED) {
    insert.run(
      newId(),
      companyId,
      t.code,
      t.name,
      t.category,
      t.entitlement,
      t.category === "unpaid" ? 0 : 1,
      now,
    );
  }
}

export function listLeaveTypes(companyId: string, db: Db = getDb()) {
  return db
    .prepare(
      `SELECT * FROM leave_types WHERE company_id = ? AND is_active = 1 ORDER BY name`,
    )
    .all(companyId);
}

export function upsertLeaveType(
  companyId: string,
  input: {
    code: string;
    name: string;
    category: string;
    defaultEntitlement: number;
    requiresAttachment?: boolean;
    requiresApproval?: boolean;
    isPaid?: boolean;
  },
  actorUserId: string,
  db: Db = getDb(),
) {
  const existing = db
    .prepare(`SELECT id FROM leave_types WHERE company_id = ? AND code = ?`)
    .get(companyId, input.code) as { id: string } | undefined;
  const now = new Date().toISOString();
  if (existing) {
    db.prepare(
      `UPDATE leave_types SET name = ?, category = ?, default_entitlement = ?,
        requires_attachment = ?, requires_approval = ?, is_paid = ?
       WHERE id = ?`,
    ).run(
      input.name,
      input.category,
      input.defaultEntitlement,
      input.requiresAttachment ? 1 : 0,
      input.requiresApproval === false ? 0 : 1,
      input.isPaid === false ? 0 : 1,
      existing.id,
    );
    writeAdminAudit({
      actorUserId,
      action: "hr.leave_type.update",
      resourceType: "leave_type",
      resourceId: existing.id,
      companyId,
      changes: input as unknown as Record<string, unknown>,
    });
    return existing.id;
  }
  const id = newId();
  db.prepare(
    `INSERT INTO leave_types
      (id, company_id, code, name, category, default_entitlement, requires_attachment, requires_approval, is_paid, is_active, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?)`,
  ).run(
    id,
    companyId,
    input.code,
    input.name,
    input.category,
    input.defaultEntitlement,
    input.requiresAttachment ? 1 : 0,
    input.requiresApproval === false ? 0 : 1,
    input.isPaid === false ? 0 : 1,
    now,
  );
  writeAdminAudit({
    actorUserId,
    action: "hr.leave_type.create",
    resourceType: "leave_type",
    resourceId: id,
    companyId,
    changes: input as unknown as Record<string, unknown>,
  });
  return id;
}

function dayCount(start: string, end: string): number {
  const a = Date.parse(start);
  const b = Date.parse(end);
  if (Number.isNaN(a) || Number.isNaN(b) || b < a) throw new Error("invalid_date_range");
  return Math.floor((b - a) / 86400000) + 1;
}

export function ensureBalance(
  companyId: string,
  employmentId: string,
  leaveTypeId: string,
  year: number,
  db: Db = getDb(),
) {
  const existing = db
    .prepare(
      `SELECT * FROM leave_balances WHERE employment_id = ? AND leave_type_id = ? AND year = ?`,
    )
    .get(employmentId, leaveTypeId, year) as { id: string } | undefined;
  if (existing) return existing.id;
  const lt = db
    .prepare(`SELECT default_entitlement FROM leave_types WHERE id = ? AND company_id = ?`)
    .get(leaveTypeId, companyId) as { default_entitlement: number } | undefined;
  if (!lt) throw new Error("leave_type_not_found");
  const id = newId();
  db.prepare(
    `INSERT INTO leave_balances
      (id, company_id, employment_id, leave_type_id, year, opening_balance, earned, used, adjusted)
     VALUES (?, ?, ?, ?, ?, ?, 0, 0, 0)`,
  ).run(id, companyId, employmentId, leaveTypeId, year, lt.default_entitlement);
  return id;
}

export function listBalances(companyId: string, employmentId: string, year: number, db: Db = getDb()) {
  return db
    .prepare(
      `SELECT b.*, t.code, t.name, t.category,
              (b.opening_balance + b.earned + b.adjusted - b.used) AS closing_balance
       FROM leave_balances b
       JOIN leave_types t ON t.id = b.leave_type_id
       WHERE b.company_id = ? AND b.employment_id = ? AND b.year = ?`,
    )
    .all(companyId, employmentId, year);
}

export function submitLeaveRequest(
  input: {
    companyId: string;
    employmentId: string;
    leaveTypeId: string;
    startDate: string;
    endDate: string;
    reason?: string;
    actorUserId: string;
  },
  db: Db = getDb(),
) {
  const profile = db
    .prepare(
      `SELECT id, status FROM employee_profiles WHERE company_id = ? AND employment_id = ?`,
    )
    .get(input.companyId, input.employmentId) as { id: string; status: string } | undefined;
  if (!profile || profile.status !== "active") throw new Error("employee_not_active");

  const totalDays = dayCount(input.startDate, input.endDate);
  const year = Number(input.startDate.slice(0, 4));
  ensureBalance(input.companyId, input.employmentId, input.leaveTypeId, year, db);

  const bal = db
    .prepare(
      `SELECT opening_balance, earned, used, adjusted FROM leave_balances
       WHERE employment_id = ? AND leave_type_id = ? AND year = ?`,
    )
    .get(input.employmentId, input.leaveTypeId, year) as {
    opening_balance: number;
    earned: number;
    used: number;
    adjusted: number;
  };
  const available = bal.opening_balance + bal.earned + bal.adjusted - bal.used;
  if (totalDays > available) throw new Error("insufficient_leave_balance");

  const id = newId();
  const now = new Date().toISOString();
  db.prepare(
    `INSERT INTO leave_requests
      (id, company_id, employment_id, leave_type_id, start_date, end_date, total_days, reason, status, submitted_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?)`,
  ).run(
    id,
    input.companyId,
    input.employmentId,
    input.leaveTypeId,
    input.startDate,
    input.endDate,
    totalDays,
    input.reason ?? null,
    now,
  );
  writeAdminAudit({
    actorUserId: input.actorUserId,
    action: "hr.leave.request",
    resourceType: "leave_request",
    resourceId: id,
    companyId: input.companyId,
    changes: { total_days: totalDays },
  });
  return db.prepare(`SELECT * FROM leave_requests WHERE id = ?`).get(id);
}

export function decideLeaveRequest(
  companyId: string,
  requestId: string,
  decision: "approved" | "rejected",
  actorUserId: string,
  rejectionReason?: string,
  db: Db = getDb(),
) {
  const req = db
    .prepare(`SELECT * FROM leave_requests WHERE id = ? AND company_id = ?`)
    .get(requestId, companyId) as
    | {
        id: string;
        status: string;
        employment_id: string;
        leave_type_id: string;
        start_date: string;
        total_days: number;
      }
    | undefined;
  if (!req) throw new Error("leave_request_not_found");
  if (req.status !== "pending") throw new Error("leave_request_not_pending");

  const now = new Date().toISOString();
  const run = db.transaction(() => {
    db.prepare(
      `UPDATE leave_requests SET status = ?, decided_by = ?, decided_at = ?, rejection_reason = ?
       WHERE id = ?`,
    ).run(
      decision,
      actorUserId,
      now,
      decision === "rejected" ? rejectionReason ?? null : null,
      requestId,
    );
    if (decision === "approved") {
      const year = Number(req.start_date.slice(0, 4));
      ensureBalance(companyId, req.employment_id, req.leave_type_id, year, db);
      db.prepare(
        `UPDATE leave_balances SET used = used + ? WHERE employment_id = ? AND leave_type_id = ? AND year = ?`,
      ).run(req.total_days, req.employment_id, req.leave_type_id, year);
    }
    writeAdminAudit({
      actorUserId,
      action: `hr.leave.${decision}`,
      resourceType: "leave_request",
      resourceId: requestId,
      companyId,
      changes: { rejection_reason: rejectionReason ?? null },
    });
  });
  run();
  return db.prepare(`SELECT * FROM leave_requests WHERE id = ?`).get(requestId);
}

export function listLeaveRequests(companyId: string, status?: string, db: Db = getDb()) {
  if (status) {
    return db
      .prepare(
        `SELECT r.*, p.full_name, p.employee_code, t.name AS leave_type_name
         FROM leave_requests r
         JOIN employee_profiles p ON p.employment_id = r.employment_id
         JOIN leave_types t ON t.id = r.leave_type_id
         WHERE r.company_id = ? AND r.status = ?
         ORDER BY r.submitted_at DESC`,
      )
      .all(companyId, status);
  }
  return db
    .prepare(
      `SELECT r.*, p.full_name, p.employee_code, t.name AS leave_type_name
       FROM leave_requests r
       JOIN employee_profiles p ON p.employment_id = r.employment_id
       JOIN leave_types t ON t.id = r.leave_type_id
       WHERE r.company_id = ?
       ORDER BY r.submitted_at DESC`,
    )
    .all(companyId);
}
