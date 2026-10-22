/**
 * Payroll periods, calculation from DB + per-company configurable policy
 * (BPJS/PPh rates + service charge equal|by_level). No hard-coded ops rates in UI.
 */
import fs from "node:fs";
import path from "node:path";
import type { Db } from "../../db/client.js";
import { getDb } from "../../db/client.js";
import { newId } from "../../lib/ids.js";
import { writeAdminAudit } from "../admin/audit.js";

export type ServiceChargeMode = "equal" | "by_level" | "off";

export type PayrollPolicy = {
  bpjs_health_employee_rate: number;
  bpjs_health_employer_rate: number;
  bpjs_jht_employee_rate: number;
  bpjs_jht_employer_rate: number;
  pph21_flat_rate: number;
  currency: string;
  /** Service charge pool distribution — per company */
  service_charge_mode: ServiceChargeMode;
  /** Default pool in minor units when period does not override */
  service_charge_default_pool_minor: number;
  /** Level code → weight (used when mode=by_level). Configurable per company. */
  service_charge_level_weights: Record<string, number>;
};

export const DEFAULT_PAYROLL_POLICY: PayrollPolicy = {
  bpjs_health_employee_rate: 0.01,
  bpjs_health_employer_rate: 0.04,
  bpjs_jht_employee_rate: 0.02,
  bpjs_jht_employer_rate: 0.037,
  pph21_flat_rate: 0.05,
  currency: "IDR",
  service_charge_mode: "equal",
  service_charge_default_pool_minor: 0,
  service_charge_level_weights: {
    L1: 1.0,
    L2: 1.2,
    L3: 1.5,
    L4: 1.8,
    L5: 2.2,
  },
};

export function getPayrollPolicy(companyId: string, db: Db = getDb()): PayrollPolicy {
  const row = db
    .prepare(
      `SELECT value_json FROM payroll_policy_config WHERE company_id = ? AND key = 'rates'`,
    )
    .get(companyId) as { value_json: string } | undefined;
  if (!row) return { ...DEFAULT_PAYROLL_POLICY, service_charge_level_weights: { ...DEFAULT_PAYROLL_POLICY.service_charge_level_weights } };
  const parsed = JSON.parse(row.value_json) as Partial<PayrollPolicy>;
  return {
    ...DEFAULT_PAYROLL_POLICY,
    ...parsed,
    service_charge_level_weights: {
      ...DEFAULT_PAYROLL_POLICY.service_charge_level_weights,
      ...(parsed.service_charge_level_weights ?? {}),
    },
  };
}

export function setPayrollPolicy(
  companyId: string,
  policy: Partial<PayrollPolicy>,
  actorUserId: string,
  db: Db = getDb(),
): PayrollPolicy {
  const current = getPayrollPolicy(companyId, db);
  const merged: PayrollPolicy = {
    ...current,
    ...policy,
    service_charge_level_weights: {
      ...current.service_charge_level_weights,
      ...(policy.service_charge_level_weights ?? {}),
    },
  };
  const now = new Date().toISOString();
  db.prepare(
    `INSERT INTO payroll_policy_config (id, company_id, key, value_json, updated_at, updated_by)
     VALUES (?, ?, 'rates', ?, ?, ?)
     ON CONFLICT(company_id, key) DO UPDATE SET
       value_json = excluded.value_json,
       updated_at = excluded.updated_at,
       updated_by = excluded.updated_by`,
  ).run(newId(), companyId, JSON.stringify(merged), now, actorUserId);
  writeAdminAudit({
    actorUserId,
    action: "hr.payroll.policy_update",
    resourceType: "payroll_policy",
    companyId,
    changes: merged as unknown as Record<string, unknown>,
  });
  return merged;
}

/**
 * Largest-remainder method so allocated minors sum exactly to pool.
 */
export function allocateServiceChargePool(
  poolMinor: number,
  recipients: Array<{ employment_id: string; weight: number }>,
): Map<string, number> {
  const out = new Map<string, number>();
  if (poolMinor <= 0 || recipients.length === 0) {
    for (const r of recipients) out.set(r.employment_id, 0);
    return out;
  }
  const totalWeight = recipients.reduce((s, r) => s + Math.max(0, r.weight), 0);
  if (totalWeight <= 0) {
    for (const r of recipients) out.set(r.employment_id, 0);
    return out;
  }
  const exact = recipients.map((r) => {
    const share = (poolMinor * Math.max(0, r.weight)) / totalWeight;
    const floor = Math.floor(share);
    return { id: r.employment_id, floor, frac: share - floor };
  });
  let assigned = exact.reduce((s, e) => s + e.floor, 0);
  let remain = poolMinor - assigned;
  exact.sort((a, b) => b.frac - a.frac);
  for (const e of exact) out.set(e.id, e.floor);
  for (let i = 0; i < exact.length && remain > 0; i += 1) {
    out.set(exact[i]!.id, (out.get(exact[i]!.id) ?? 0) + 1);
    remain -= 1;
  }
  return out;
}

export function createPayrollPeriod(
  input: {
    companyId: string;
    periodCode: string;
    startDate: string;
    endDate: string;
    payDate: string;
    actorUserId: string;
    serviceChargePoolMinor?: number;
  },
  db: Db = getDb(),
) {
  const policy = getPayrollPolicy(input.companyId, db);
  const pool =
    input.serviceChargePoolMinor !== undefined
      ? input.serviceChargePoolMinor
      : policy.service_charge_default_pool_minor;
  const id = newId();
  const now = new Date().toISOString();
  db.prepare(
    `INSERT INTO payroll_periods
      (id, company_id, period_code, start_date, end_date, pay_date, status,
       service_charge_pool_minor, created_by, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, 'DRAFT', ?, ?, ?, ?)`,
  ).run(
    id,
    input.companyId,
    input.periodCode,
    input.startDate,
    input.endDate,
    input.payDate,
    pool,
    input.actorUserId,
    now,
    now,
  );
  writeAdminAudit({
    actorUserId: input.actorUserId,
    action: "hr.payroll.period_create",
    resourceType: "payroll_period",
    resourceId: id,
    companyId: input.companyId,
    changes: { service_charge_pool_minor: pool },
  });
  return db.prepare(`SELECT * FROM payroll_periods WHERE id = ?`).get(id);
}

export function listPayrollPeriods(companyId: string, db: Db = getDb()) {
  return db
    .prepare(`SELECT * FROM payroll_periods WHERE company_id = ? ORDER BY start_date DESC`)
    .all(companyId);
}

function assertPeriodMutable(status: string) {
  if (status === "FINALIZED" || status === "LOCKED") {
    throw new Error("payroll_period_locked");
  }
}

export function calculatePayrollPeriod(
  companyId: string,
  periodId: string,
  actorUserId: string,
  db: Db = getDb(),
  opts?: { serviceChargePoolMinor?: number },
) {
  const period = db
    .prepare(`SELECT * FROM payroll_periods WHERE id = ? AND company_id = ?`)
    .get(periodId, companyId) as
    | { id: string; status: string; service_charge_pool_minor: number }
    | undefined;
  if (!period) throw new Error("period_not_found");
  assertPeriodMutable(period.status);

  const policy = getPayrollPolicy(companyId, db);
  if (opts?.serviceChargePoolMinor !== undefined) {
    db.prepare(`UPDATE payroll_periods SET service_charge_pool_minor = ? WHERE id = ?`).run(
      opts.serviceChargePoolMinor,
      periodId,
    );
    period.service_charge_pool_minor = opts.serviceChargePoolMinor;
  }

  const employees = db
    .prepare(
      `SELECT employment_id, full_name, base_salary_minor, currency, job_level, service_charge_eligible
       FROM employee_profiles
       WHERE company_id = ? AND status = 'active'`,
    )
    .all(companyId) as Array<{
    employment_id: string;
    full_name: string;
    base_salary_minor: number;
    currency: string;
    job_level: string;
    service_charge_eligible: number;
  }>;

  const eligible = employees.filter((e) => e.service_charge_eligible !== 0);
  const pool = period.service_charge_pool_minor || 0;
  let scMap = new Map<string, number>();
  if (policy.service_charge_mode !== "off" && pool > 0 && eligible.length > 0) {
    const recipients =
      policy.service_charge_mode === "equal"
        ? eligible.map((e) => ({ employment_id: e.employment_id, weight: 1 }))
        : eligible.map((e) => ({
            employment_id: e.employment_id,
            weight:
              policy.service_charge_level_weights[e.job_level] ??
              policy.service_charge_level_weights.L2 ??
              1,
          }));
    scMap = allocateServiceChargePool(pool, recipients);
  }

  const now = new Date().toISOString();
  const run = db.transaction(() => {
    db.prepare(`DELETE FROM payroll_items WHERE payroll_record_id IN
      (SELECT id FROM payroll_records WHERE payroll_period_id = ?)`).run(periodId);
    db.prepare(`DELETE FROM payslips WHERE payroll_record_id IN
      (SELECT id FROM payroll_records WHERE payroll_period_id = ?)`).run(periodId);
    db.prepare(`DELETE FROM payroll_records WHERE payroll_period_id = ?`).run(periodId);

    for (const emp of employees) {
      const basic = emp.base_salary_minor || 0;
      const serviceCharge = scMap.get(emp.employment_id) ?? 0;
      const gross = basic + serviceCharge;
      const bpjsHealth = Math.round(basic * policy.bpjs_health_employee_rate);
      const bpjsJht = Math.round(basic * policy.bpjs_jht_employee_rate);
      const taxable = Math.max(0, gross - bpjsHealth - bpjsJht);
      const pph = Math.round(taxable * policy.pph21_flat_rate);
      const deductions = bpjsHealth + bpjsJht + pph;
      const net = gross - deductions;
      const recordId = newId();
      db.prepare(
        `INSERT INTO payroll_records
          (id, company_id, payroll_period_id, employment_id, gross_pay_minor, total_deductions_minor,
           net_pay_minor, currency, status, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'CALCULATED', ?, ?)`,
      ).run(
        recordId,
        companyId,
        periodId,
        emp.employment_id,
        gross,
        deductions,
        net,
        emp.currency || policy.currency,
        now,
        now,
      );

      const items: Array<[string, string, "earning" | "deduction", number]> = [
        ["BASIC_SALARY", "Basic Salary", "earning", basic],
      ];
      if (serviceCharge > 0) {
        items.push(["SERVICE_CHARGE", "Service Charge", "earning", serviceCharge]);
      }
      items.push(
        ["BPJS_HEALTH", "BPJS Health (employee)", "deduction", bpjsHealth],
        ["BPJS_JHT", "BPJS JHT (employee)", "deduction", bpjsJht],
        ["PPH21", "PPh 21", "deduction", pph],
      );
      for (const [code, name, cat, amount] of items) {
        db.prepare(
          `INSERT INTO payroll_items
            (id, payroll_record_id, component_code, component_name, category, amount_minor, source_type, created_at)
           VALUES (?, ?, ?, ?, ?, ?, 'policy', ?)`,
        ).run(newId(), recordId, code, name, cat, amount, now);
      }
    }

    db.prepare(
      `UPDATE payroll_periods SET status = 'CALCULATED', updated_at = ? WHERE id = ?`,
    ).run(now, periodId);
    writeAdminAudit({
      actorUserId,
      action: "hr.payroll.calculate",
      resourceType: "payroll_period",
      resourceId: periodId,
      companyId,
      changes: {
        employees: employees.length,
        service_charge_mode: policy.service_charge_mode,
        service_charge_pool_minor: pool,
      },
    });
  });
  run();
  return getPeriodDetail(companyId, periodId, db);
}

export function transitionPayrollPeriod(
  companyId: string,
  periodId: string,
  toStatus: "UNDER_REVIEW" | "APPROVED" | "FINALIZED" | "LOCKED",
  actorUserId: string,
  db: Db = getDb(),
) {
  const period = db
    .prepare(`SELECT * FROM payroll_periods WHERE id = ? AND company_id = ?`)
    .get(periodId, companyId) as { id: string; status: string } | undefined;
  if (!period) throw new Error("period_not_found");

  const allowed: Record<string, string[]> = {
    CALCULATED: ["UNDER_REVIEW"],
    UNDER_REVIEW: ["APPROVED", "CALCULATED"],
    APPROVED: ["FINALIZED"],
    FINALIZED: ["LOCKED"],
  };
  const next = allowed[period.status] ?? [];
  if (!next.includes(toStatus)) {
    throw new Error(`invalid_transition:${period.status}->${toStatus}`);
  }

  const now = new Date().toISOString();
  db.prepare(
    `UPDATE payroll_periods SET status = ?, updated_at = ?,
      finalized_by = CASE WHEN ? = 'FINALIZED' THEN ? ELSE finalized_by END,
      finalized_at = CASE WHEN ? = 'FINALIZED' THEN ? ELSE finalized_at END
     WHERE id = ?`,
  ).run(toStatus, now, toStatus, actorUserId, toStatus, now, periodId);

  if (toStatus === "FINALIZED") {
    generatePayslips(companyId, periodId, actorUserId, db);
  }

  writeAdminAudit({
    actorUserId,
    action: "hr.payroll.transition",
    resourceType: "payroll_period",
    resourceId: periodId,
    companyId,
    changes: { from: period.status, to: toStatus },
  });
  return getPeriodDetail(companyId, periodId, db);
}

function payslipDir(): string {
  const dir =
    process.env.WOLF_PAYSLIP_DIR ?? path.join(process.cwd(), "data", "payslips");
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

export function generatePayslips(
  companyId: string,
  periodId: string,
  actorUserId: string,
  db: Db = getDb(),
) {
  const records = db
    .prepare(
      `SELECT r.*, p.full_name, p.employee_code, p.work_email, per.period_code
       FROM payroll_records r
       JOIN employee_profiles p ON p.employment_id = r.employment_id
       JOIN payroll_periods per ON per.id = r.payroll_period_id
       WHERE r.payroll_period_id = ? AND r.company_id = ?`,
    )
    .all(periodId, companyId) as Array<{
    id: string;
    full_name: string;
    employee_code: string;
    work_email: string | null;
    period_code: string;
    gross_pay_minor: number;
    total_deductions_minor: number;
    net_pay_minor: number;
    currency: string;
  }>;

  const now = new Date().toISOString();
  const dir = payslipDir();
  for (const rec of records) {
    const items = db
      .prepare(`SELECT * FROM payroll_items WHERE payroll_record_id = ?`)
      .all(rec.id) as Array<{ component_name: string; category: string; amount_minor: number }>;
    const lines = [
      `ATRIUM HRIS Payslip (generated fake)`,
      `Period: ${rec.period_code}`,
      `Employee: ${rec.employee_code} — ${rec.full_name}`,
      `Gross: ${rec.gross_pay_minor} ${rec.currency} (minor units)`,
      `Deductions: ${rec.total_deductions_minor}`,
      `Net: ${rec.net_pay_minor}`,
      "",
      ...items.map((i) => `${i.category}\t${i.component_name}\t${i.amount_minor}`),
      "",
      `Generated-At: ${now}`,
    ].join("\n");
    const filePath = path.join(dir, `${rec.period_code}-${rec.employee_code}.txt`);
    fs.writeFileSync(filePath, lines, "utf8");
    const existing = db
      .prepare(`SELECT id FROM payslips WHERE payroll_record_id = ?`)
      .get(rec.id) as { id: string } | undefined;
    if (existing) {
      db.prepare(
        `UPDATE payslips SET file_path = ?, generated_at = ?, published_at = ? WHERE id = ?`,
      ).run(filePath, now, now, existing.id);
    } else {
      db.prepare(
        `INSERT INTO payslips
          (id, company_id, payroll_record_id, file_path, generated_at, published_at, email_status)
         VALUES (?, ?, ?, ?, ?, ?, 'not_sent')`,
      ).run(newId(), companyId, rec.id, filePath, now, now);
    }
  }
  writeAdminAudit({
    actorUserId,
    action: "hr.payroll.payslips_generate",
    resourceType: "payroll_period",
    resourceId: periodId,
    companyId,
    changes: { count: records.length },
  });
}

export async function emailPayslip(
  companyId: string,
  payslipId: string,
  actorUserId: string,
  db: Db = getDb(),
): Promise<{ emailStatus: string; to: string | null }> {
  const row = db
    .prepare(
      `SELECT s.*, p.work_email, p.full_name, p.employee_code, r.net_pay_minor, r.currency
       FROM payslips s
       JOIN payroll_records r ON r.id = s.payroll_record_id
       JOIN employee_profiles p ON p.employment_id = r.employment_id
       WHERE s.id = ? AND s.company_id = ?`,
    )
    .get(payslipId, companyId) as
    | {
        id: string;
        work_email: string | null;
        full_name: string;
        employee_code: string;
        file_path: string | null;
        net_pay_minor: number;
        currency: string;
      }
    | undefined;
  if (!row) throw new Error("payslip_not_found");
  const to = row.work_email;
  if (!to) {
    db.prepare(
      `UPDATE payslips SET email_status = 'failed', email_error = 'no_work_email', emailed_at = ? WHERE id = ?`,
    ).run(new Date().toISOString(), payslipId);
    return { emailStatus: "failed", to: null };
  }

  const now = new Date().toISOString();
  db.prepare(
    `UPDATE payslips SET email_status = 'queued', email_to = ?, emailed_at = ? WHERE id = ?`,
  ).run(to, now, payslipId);

  try {
    const payload = {
      from: process.env.PAYSLIP_FROM ?? "hris-noreply@wolf.example",
      to,
      subject: `Payslip ${row.employee_code}`,
      text: `Payslip for ${row.full_name}. Net ${row.net_pay_minor} ${row.currency} (minor units).`,
      attachmentPath: row.file_path,
      at: now,
    };
    const webhook = process.env.MAIL_WEBHOOK_URL ?? process.env.SMTP_URL;
    if (webhook && webhook.startsWith("http")) {
      const res = await fetch(webhook, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error(`mail_webhook_${res.status}`);
    } else {
      const mailDir =
        process.env.WOLF_MAIL_DIR ?? path.join(process.cwd(), "data", "mail");
      fs.mkdirSync(mailDir, { recursive: true });
      fs.writeFileSync(
        path.join(mailDir, `payslip-${payslipId}.json`),
        JSON.stringify({ ...payload, stub: true }, null, 2),
      );
    }
    db.prepare(
      `UPDATE payslips SET email_status = 'sent', email_error = NULL, emailed_at = ? WHERE id = ?`,
    ).run(new Date().toISOString(), payslipId);
    writeAdminAudit({
      actorUserId,
      action: "hr.payroll.payslip_email",
      resourceType: "payslip",
      resourceId: payslipId,
      companyId,
      changes: { to, status: "sent" },
    });
    return { emailStatus: "sent", to };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    db.prepare(
      `UPDATE payslips SET email_status = 'failed', email_error = ?, emailed_at = ? WHERE id = ?`,
    ).run(msg, new Date().toISOString(), payslipId);
    return { emailStatus: "failed", to };
  }
}

export function getPeriodDetail(companyId: string, periodId: string, db: Db = getDb()) {
  const period = db
    .prepare(`SELECT * FROM payroll_periods WHERE id = ? AND company_id = ?`)
    .get(periodId, companyId);
  if (!period) return null;
  const records = db
    .prepare(
      `SELECT r.*, p.full_name, p.employee_code, p.job_level,
              (SELECT email_status FROM payslips s WHERE s.payroll_record_id = r.id) AS email_status,
              (SELECT id FROM payslips s WHERE s.payroll_record_id = r.id) AS payslip_id
       FROM payroll_records r
       JOIN employee_profiles p ON p.employment_id = r.employment_id
       WHERE r.payroll_period_id = ?`,
    )
    .all(periodId);
  return { period, records, policy: getPayrollPolicy(companyId, db) };
}

export function listPayslips(companyId: string, periodId?: string, db: Db = getDb()) {
  if (periodId) {
    return db
      .prepare(
        `SELECT s.*, p.full_name, p.employee_code, r.net_pay_minor, r.currency
         FROM payslips s
         JOIN payroll_records r ON r.id = s.payroll_record_id
         JOIN employee_profiles p ON p.employment_id = r.employment_id
         WHERE s.company_id = ? AND r.payroll_period_id = ?
         ORDER BY p.employee_code`,
      )
      .all(companyId, periodId);
  }
  return db
    .prepare(
      `SELECT s.*, p.full_name, p.employee_code, r.net_pay_minor, r.currency
       FROM payslips s
       JOIN payroll_records r ON r.id = s.payroll_record_id
       JOIN employee_profiles p ON p.employment_id = r.employment_id
       WHERE s.company_id = ?
       ORDER BY s.generated_at DESC`,
    )
    .all(companyId);
}
