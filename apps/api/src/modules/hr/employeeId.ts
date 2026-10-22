/**
 * Employee ID = ENTITY + YY + MM + SEQUENCE (zero-padded 4).
 * Example: AMG26100001 for company code AMG, Oct 2026, seq 1.
 */
import type { Db } from "../../db/client.js";
import { getDb } from "../../db/client.js";

export function nextEmployeeCode(
  companyId: string,
  companyCode: string,
  joinDateIso: string,
  db: Db = getDb(),
): string {
  const d = new Date(joinDateIso);
  if (Number.isNaN(d.getTime())) {
    throw new Error("invalid_join_date");
  }
  const yy = String(d.getUTCFullYear()).slice(-2);
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  const yyMm = `${yy}${mm}`;
  const entity = companyCode.replace(/[^A-Za-z0-9]/g, "").toUpperCase();
  if (!entity) throw new Error("invalid_company_code");

  const tx = db.transaction(() => {
    const row = db
      .prepare(
        `SELECT last_seq FROM employee_id_sequences WHERE company_id = ? AND yy_mm = ?`,
      )
      .get(companyId, yyMm) as { last_seq: number } | undefined;
    const next = (row?.last_seq ?? 0) + 1;
    if (row) {
      db.prepare(
        `UPDATE employee_id_sequences SET last_seq = ? WHERE company_id = ? AND yy_mm = ?`,
      ).run(next, companyId, yyMm);
    } else {
      db.prepare(
        `INSERT INTO employee_id_sequences (company_id, yy_mm, last_seq) VALUES (?, ?, ?)`,
      ).run(companyId, yyMm, next);
    }
    return `${entity}${yyMm}${String(next).padStart(4, "0")}`;
  });
  return tx();
}
