import type { Db } from "../../db/client.js";
import { getDb } from "../../db/client.js";
import { newId } from "../../lib/ids.js";

export function listDepartments(companyId: string, db: Db = getDb()) {
  return db
    .prepare(
      `SELECT * FROM hr_departments WHERE company_id = ? AND is_active = 1 ORDER BY name`,
    )
    .all(companyId);
}

export function listPositions(companyId: string, db: Db = getDb()) {
  return db
    .prepare(
      `SELECT * FROM hr_positions WHERE company_id = ? AND is_active = 1 ORDER BY title`,
    )
    .all(companyId);
}

export function ensureDemoOrg(companyId: string, db: Db = getDb()): void {
  const now = new Date().toISOString();
  const depts = [
    { code: "FO", name: "Front Office" },
    { code: "HK", name: "Housekeeping" },
    { code: "FB", name: "Food & Beverage" },
    { code: "HR", name: "Human Resources" },
  ];
  for (const d of depts) {
    const existing = db
      .prepare(`SELECT id FROM hr_departments WHERE company_id = ? AND code = ?`)
      .get(companyId, d.code) as { id: string } | undefined;
    if (existing) continue;
    db.prepare(
      `INSERT INTO hr_departments (id, company_id, code, name, is_active, created_at)
       VALUES (?, ?, ?, ?, 1, ?)`,
    ).run(newId(), companyId, d.code, d.name, now);
  }
  const fo = db
    .prepare(`SELECT id FROM hr_departments WHERE company_id = ? AND code = 'FO'`)
    .get(companyId) as { id: string } | undefined;
  if (fo) {
    const positions = [
      { code: "FO-MGR", title: "Front Office Manager" },
      { code: "FO-REC", title: "Receptionist" },
    ];
    for (const p of positions) {
      const exists = db
        .prepare(`SELECT 1 AS ok FROM hr_positions WHERE company_id = ? AND code = ?`)
        .get(companyId, p.code);
      if (exists) continue;
      db.prepare(
        `INSERT INTO hr_positions (id, company_id, department_id, code, title, is_active, created_at)
         VALUES (?, ?, ?, ?, ?, 1, ?)`,
      ).run(newId(), companyId, fo.id, p.code, p.title, now);
    }
  }
}
