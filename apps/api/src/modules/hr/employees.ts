/**
 * Employee master — company-scoped profiles + employments + event publish.
 */
import type { Db } from "../../db/client.js";
import { getDb } from "../../db/client.js";
import { newId } from "../../lib/ids.js";
import { writeAdminAudit } from "../admin/audit.js";
import { nextEmployeeCode } from "./employeeId.js";
import { publishEmployeeCreated, publishEmployeeUpdated } from "./publishers.js";
import { relayOnce } from "../integration/outbox.js";

export type CreateEmployeeInput = {
  companyId: string;
  fullName: string;
  preferredName?: string;
  workEmail?: string;
  phone?: string;
  dateOfBirth?: string;
  gender?: string;
  nik?: string;
  npwp?: string;
  address?: string;
  emergencyContactName?: string;
  emergencyContactPhone?: string;
  departmentId?: string;
  positionId?: string;
  employmentType?: string;
  jobTitle?: string;
  jobLevel?: string;
  serviceChargeEligible?: boolean;
  costCentre?: string;
  bankName?: string;
  bankAccountNumber?: string;
  bankAccountName?: string;
  baseSalaryMinor?: number;
  currency?: string;
  joinDate: string;
  actorUserId: string;
  /** Optional link to existing Wolf user */
  userId?: string;
  /** When true, enqueue outbox only — caller relays after outer commit */
  skipRelay?: boolean;
};

const LIST_MASK = {
  nik: "***",
  npwp: "***",
  bank_account_number: "***",
  date_of_birth: "***",
  address: "***",
} as const;

export function listEmployees(companyId: string, db: Db = getDb()) {
  const rows = db
    .prepare(
      `SELECT p.id, p.employment_id, p.company_id, p.employee_code, p.full_name, p.preferred_name,
              p.work_email, p.phone, p.job_title, p.job_level, p.service_charge_eligible,
              p.cost_centre, p.employment_type, p.join_date,
              p.status, p.department_id, p.position_id, p.base_salary_minor, p.currency,
              p.nik, p.npwp, p.bank_account_number, p.date_of_birth, p.address,
              d.name AS department_name, pos.title AS position_title
       FROM employee_profiles p
       LEFT JOIN hr_departments d ON d.id = p.department_id
       LEFT JOIN hr_positions pos ON pos.id = p.position_id
       WHERE p.company_id = ?
       ORDER BY p.full_name COLLATE NOCASE`,
    )
    .all(companyId) as Array<Record<string, unknown>>;

  return rows.map((r) => ({
    ...r,
    nik: r.nik ? LIST_MASK.nik : null,
    npwp: r.npwp ? LIST_MASK.npwp : null,
    bank_account_number: r.bank_account_number ? LIST_MASK.bank_account_number : null,
    date_of_birth: r.date_of_birth ? LIST_MASK.date_of_birth : null,
    address: r.address ? LIST_MASK.address : null,
    _masked: true,
  }));
}

export function getEmployee(
  companyId: string,
  employmentId: string,
  opts: { includeRestricted: boolean; actorUserId: string },
  db: Db = getDb(),
) {
  const row = db
    .prepare(
      `SELECT p.*, d.name AS department_name, pos.title AS position_title, e.user_id, e.employee_no
       FROM employee_profiles p
       JOIN employments e ON e.id = p.employment_id
       LEFT JOIN hr_departments d ON d.id = p.department_id
       LEFT JOIN hr_positions pos ON pos.id = p.position_id
       WHERE p.company_id = ? AND p.employment_id = ?`,
    )
    .get(companyId, employmentId) as Record<string, unknown> | undefined;
  if (!row) return null;

  if (opts.includeRestricted) {
    writeAdminAudit({
      actorUserId: opts.actorUserId,
      action: "hr.employee.read_restricted",
      resourceType: "employee_profile",
      resourceId: String(row.id),
      companyId,
      changes: { fields: ["nik", "npwp", "bank", "dob", "address"] },
    });
    return row;
  }
  return {
    ...row,
    nik: row.nik ? LIST_MASK.nik : null,
    npwp: row.npwp ? LIST_MASK.npwp : null,
    bank_account_number: row.bank_account_number ? LIST_MASK.bank_account_number : null,
    bank_name: row.bank_name ? "***" : null,
    date_of_birth: row.date_of_birth ? LIST_MASK.date_of_birth : null,
    address: row.address ? LIST_MASK.address : null,
    _masked: true,
  };
}

export function createEmployee(input: CreateEmployeeInput, db: Db = getDb()) {
  const company = db
    .prepare(`SELECT id, code FROM companies WHERE id = ?`)
    .get(input.companyId) as { id: string; code: string } | undefined;
  if (!company) throw new Error("company_not_found");

  const fullName = input.fullName.trim();
  if (!fullName) throw new Error("full_name_required");
  if (!input.joinDate) throw new Error("join_date_required");

  const now = new Date().toISOString();
  const employmentId = newId();
  const profileId = newId();
  const employeeCode = nextEmployeeCode(input.companyId, company.code, input.joinDate, db);

  // Placeholder user if not linked — employment requires user_id FK
  let userId = input.userId;
  if (!userId) {
    userId = newId();
    const email =
      input.workEmail?.trim().toLowerCase() ||
      `${employeeCode.toLowerCase()}@hr-fake.wolf.example`;
    db.prepare(
      `INSERT INTO users (id, email, display_name, status, password_hash, created_at)
       VALUES (?, ?, ?, 'active', NULL, ?)`,
    ).run(userId, email, fullName, now);
  }

  const run = db.transaction(() => {
    db.prepare(
      `INSERT INTO employments (id, user_id, company_id, employee_no, status, valid_from, valid_to)
       VALUES (?, ?, ?, ?, 'active', ?, NULL)`,
    ).run(employmentId, userId, input.companyId, employeeCode, input.joinDate);

    db.prepare(
      `INSERT INTO employee_profiles (
        id, employment_id, company_id, employee_code, full_name, preferred_name, work_email, phone,
        date_of_birth, gender, nik, npwp, address, emergency_contact_name, emergency_contact_phone,
        department_id, position_id, employment_type, job_title, job_level, service_charge_eligible,
        cost_centre, bank_name, bank_account_number, bank_account_name, base_salary_minor, currency,
        join_date, status, created_at, updated_at, created_by, updated_by
      ) VALUES (
        @id, @employmentId, @companyId, @employeeCode, @fullName, @preferredName, @workEmail, @phone,
        @dateOfBirth, @gender, @nik, @npwp, @address, @emergencyContactName, @emergencyContactPhone,
        @departmentId, @positionId, @employmentType, @jobTitle, @jobLevel, @serviceChargeEligible,
        @costCentre, @bankName, @bankAccountNumber, @bankAccountName, @baseSalaryMinor, @currency,
        @joinDate, 'active', @now, @now, @actor, @actor
      )`,
    ).run({
      id: profileId,
      employmentId,
      companyId: input.companyId,
      employeeCode,
      fullName,
      preferredName: input.preferredName ?? null,
      workEmail: input.workEmail ?? null,
      phone: input.phone ?? null,
      dateOfBirth: input.dateOfBirth ?? null,
      gender: input.gender ?? null,
      nik: input.nik ?? null,
      npwp: input.npwp ?? null,
      address: input.address ?? null,
      emergencyContactName: input.emergencyContactName ?? null,
      emergencyContactPhone: input.emergencyContactPhone ?? null,
      departmentId: input.departmentId ?? null,
      positionId: input.positionId ?? null,
      employmentType: input.employmentType ?? "permanent",
      jobTitle: input.jobTitle ?? null,
      jobLevel: input.jobLevel ?? "L2",
      serviceChargeEligible: input.serviceChargeEligible === false ? 0 : 1,
      costCentre: input.costCentre ?? null,
      bankName: input.bankName ?? null,
      bankAccountNumber: input.bankAccountNumber ?? null,
      bankAccountName: input.bankAccountName ?? null,
      baseSalaryMinor: input.baseSalaryMinor ?? 0,
      currency: input.currency ?? "IDR",
      joinDate: input.joinDate,
      now,
      actor: input.actorUserId,
    });

    // Base staff grants for portal self-service
    for (const perm of ["hr.self.read", "hr.self.write", "hr.leave.request"]) {
      db.prepare(
        `INSERT OR IGNORE INTO permissions (key, description, default_classification) VALUES (?, ?, 2)`,
      ).run(perm, perm);
      db.prepare(
        `INSERT INTO grants (id, user_id, role_id, permission_key, scope_type, scope_id, valid_from, valid_to, granted_by, reason, ticket_ref)
         VALUES (?, ?, NULL, ?, 'self', ?, ?, NULL, ?, 'hr onboarding base', NULL)`,
      ).run(newId(), userId, perm, userId, input.joinDate, input.actorUserId);
    }

    publishEmployeeCreated(
      {
        employment_id: employmentId,
        company_id: input.companyId,
        display_name: fullName,
        cost_centre: input.costCentre ?? null,
        employee_code: employeeCode,
      },
      db,
      { relay: false },
    );

    writeAdminAudit({
      actorUserId: input.actorUserId,
      action: "hr.employee.create",
      resourceType: "employee_profile",
      resourceId: profileId,
      companyId: input.companyId,
      changes: { employee_code: employeeCode, employment_id: employmentId },
    });
  });

  run();
  if (!input.skipRelay) {
    void relayOnce(db);
  }
  return getEmployee(input.companyId, employmentId, {
    includeRestricted: true,
    actorUserId: input.actorUserId,
  })!;
}

export function updateEmployee(
  companyId: string,
  employmentId: string,
  patch: Partial<CreateEmployeeInput>,
  actorUserId: string,
  db: Db = getDb(),
) {
  const existing = db
    .prepare(`SELECT * FROM employee_profiles WHERE company_id = ? AND employment_id = ?`)
    .get(companyId, employmentId) as Record<string, unknown> | undefined;
  if (!existing) throw new Error("employee_not_found");
  if (existing.status === "ended") throw new Error("employee_ended");

  const now = new Date().toISOString();
  const fullName = (patch.fullName ?? String(existing.full_name)).trim();
  db.prepare(
    `UPDATE employee_profiles SET
      full_name = @fullName,
      preferred_name = @preferredName,
      work_email = @workEmail,
      phone = @phone,
      date_of_birth = @dateOfBirth,
      gender = @gender,
      nik = @nik,
      npwp = @npwp,
      address = @address,
      emergency_contact_name = @emergencyContactName,
      emergency_contact_phone = @emergencyContactPhone,
      department_id = @departmentId,
      position_id = @positionId,
      employment_type = @employmentType,
      job_title = @jobTitle,
      job_level = @jobLevel,
      service_charge_eligible = @serviceChargeEligible,
      cost_centre = @costCentre,
      bank_name = @bankName,
      bank_account_number = @bankAccountNumber,
      bank_account_name = @bankAccountName,
      base_salary_minor = @baseSalaryMinor,
      currency = @currency,
      updated_at = @now,
      updated_by = @actor
     WHERE employment_id = @employmentId AND company_id = @companyId`,
  ).run({
    fullName,
    preferredName: patch.preferredName ?? existing.preferred_name,
    workEmail: patch.workEmail ?? existing.work_email,
    phone: patch.phone ?? existing.phone,
    dateOfBirth: patch.dateOfBirth ?? existing.date_of_birth,
    gender: patch.gender ?? existing.gender,
    nik: patch.nik ?? existing.nik,
    npwp: patch.npwp ?? existing.npwp,
    address: patch.address ?? existing.address,
    emergencyContactName: patch.emergencyContactName ?? existing.emergency_contact_name,
    emergencyContactPhone: patch.emergencyContactPhone ?? existing.emergency_contact_phone,
    departmentId: patch.departmentId ?? existing.department_id,
    positionId: patch.positionId ?? existing.position_id,
    employmentType: patch.employmentType ?? existing.employment_type,
    jobTitle: patch.jobTitle ?? existing.job_title,
    jobLevel: patch.jobLevel ?? existing.job_level ?? "L2",
    serviceChargeEligible:
      patch.serviceChargeEligible === undefined
        ? (existing.service_charge_eligible ?? 1)
        : patch.serviceChargeEligible === false
          ? 0
          : 1,
    costCentre: patch.costCentre ?? existing.cost_centre,
    bankName: patch.bankName ?? existing.bank_name,
    bankAccountNumber: patch.bankAccountNumber ?? existing.bank_account_number,
    bankAccountName: patch.bankAccountName ?? existing.bank_account_name,
    baseSalaryMinor: patch.baseSalaryMinor ?? existing.base_salary_minor,
    currency: patch.currency ?? existing.currency,
    now,
    actor: actorUserId,
    employmentId,
    companyId,
  });

  publishEmployeeUpdated(
    {
      employment_id: employmentId,
      company_id: companyId,
      display_name: fullName,
      cost_centre: (patch.costCentre ?? existing.cost_centre) as string | null,
      employee_code: String(existing.employee_code),
    },
    db,
    { relay: false },
  );

  writeAdminAudit({
    actorUserId,
    action: "hr.employee.update",
    resourceType: "employee_profile",
    resourceId: String(existing.id),
    companyId,
    changes: patch as Record<string, unknown>,
  });

  void relayOnce(db);
  return getEmployee(companyId, employmentId, { includeRestricted: true, actorUserId })!;
}

export type ImportRow = {
  fullName: string;
  workEmail?: string;
  departmentCode?: string;
  jobTitle?: string;
  joinDate: string;
  employmentType?: string;
  costCentre?: string;
  baseSalaryMinor?: number;
};

export function importEmployeesPreview(
  companyId: string,
  rows: ImportRow[],
  db: Db = getDb(),
): { ok: boolean; errors: Array<{ row: number; message: string }>; validCount: number } {
  const errors: Array<{ row: number; message: string }> = [];
  const emails = new Set<string>();
  rows.forEach((r, i) => {
    const row = i + 1;
    if (!r.fullName?.trim()) errors.push({ row, message: "full_name_required" });
    if (!r.joinDate) errors.push({ row, message: "join_date_required" });
    else if (Number.isNaN(Date.parse(r.joinDate))) errors.push({ row, message: "join_date_invalid" });
    if (r.workEmail) {
      const e = r.workEmail.trim().toLowerCase();
      if (emails.has(e)) errors.push({ row, message: "duplicate_email_in_file" });
      emails.add(e);
      const exists = db.prepare(`SELECT 1 AS ok FROM users WHERE email = ?`).get(e);
      if (exists) errors.push({ row, message: "email_already_registered" });
    }
    if (r.departmentCode) {
      const d = db
        .prepare(`SELECT 1 AS ok FROM hr_departments WHERE company_id = ? AND code = ?`)
        .get(companyId, r.departmentCode);
      if (!d) errors.push({ row, message: `unknown_department:${r.departmentCode}` });
    }
  });
  return { ok: errors.length === 0, errors, validCount: rows.length - new Set(errors.map((e) => e.row)).size };
}

export function importEmployeesCommit(
  companyId: string,
  rows: ImportRow[],
  actorUserId: string,
  db: Db = getDb(),
) {
  const preview = importEmployeesPreview(companyId, rows, db);
  if (!preview.ok) {
    const err = new Error("import_validation_failed") as Error & { errors: typeof preview.errors };
    err.errors = preview.errors;
    throw err;
  }
  const created: Array<Record<string, unknown>> = [];
  const tx = db.transaction(() => {
    for (const r of rows) {
      let departmentId: string | undefined;
      if (r.departmentCode) {
        const d = db
          .prepare(`SELECT id FROM hr_departments WHERE company_id = ? AND code = ?`)
          .get(companyId, r.departmentCode) as { id: string };
        departmentId = d.id;
      }
      created.push(
        createEmployee(
          {
            companyId,
            fullName: r.fullName,
            workEmail: r.workEmail,
            departmentId,
            jobTitle: r.jobTitle,
            joinDate: r.joinDate,
            employmentType: r.employmentType,
            costCentre: r.costCentre,
            baseSalaryMinor: r.baseSalaryMinor,
            actorUserId,
            skipRelay: true,
          },
          db,
        ),
      );
    }
  });
  tx();
  void relayOnce(db);
  writeAdminAudit({
    actorUserId,
    action: "hr.employee.import",
    resourceType: "employee_import",
    companyId,
    changes: { count: created.length },
  });
  return { created: created.length, employees: created };
}
