/**
 * Offboarding as one transaction: end employment, expire grants, revoke sessions, publish event.
 */
import type { Db } from "../../db/client.js";
import { getDb } from "../../db/client.js";
import { writeAdminAudit } from "../admin/audit.js";
import { revokeAllUserSessions } from "../identity/sessions.js";
import { publishEmploymentEnded } from "./publishers.js";
import { relayOnce } from "../integration/outbox.js";

export function offboardEmployment(
  companyId: string,
  employmentId: string,
  actorUserId: string,
  endDateIso: string,
  db: Db = getDb(),
) {
  const profile = db
    .prepare(
      `SELECT p.*, e.user_id FROM employee_profiles p
       JOIN employments e ON e.id = p.employment_id
       WHERE p.company_id = ? AND p.employment_id = ?`,
    )
    .get(companyId, employmentId) as
    | { id: string; full_name: string; cost_centre: string | null; employee_code: string; user_id: string; status: string }
    | undefined;
  if (!profile) throw new Error("employee_not_found");
  if (profile.status === "ended") throw new Error("already_ended");

  const now = new Date().toISOString();
  const endDate = endDateIso || now.slice(0, 10);

  const run = db.transaction(() => {
    db.prepare(
      `UPDATE employments SET status = 'ended', valid_to = ? WHERE id = ? AND company_id = ?`,
    ).run(endDate, employmentId, companyId);
    db.prepare(
      `UPDATE employee_profiles SET status = 'ended', updated_at = ?, updated_by = ? WHERE employment_id = ?`,
    ).run(now, actorUserId, employmentId);
    db.prepare(
      `UPDATE grants SET valid_to = ? WHERE user_id = ? AND (valid_to IS NULL OR valid_to > ?)
       AND (scope_id = ? OR scope_type = 'self')`,
    ).run(endDate, profile.user_id, endDate, companyId);
    revokeAllUserSessions(db, profile.user_id);

    // Escalate pending leave: auto-cancel for ended employment
    db.prepare(
      `UPDATE leave_requests SET status = 'cancelled', decided_at = ?, decided_by = ?, rejection_reason = 'employment_ended'
       WHERE employment_id = ? AND status = 'pending'`,
    ).run(now, actorUserId, employmentId);

    publishEmploymentEnded(
      {
        employment_id: employmentId,
        company_id: companyId,
        display_name: profile.full_name,
        cost_centre: profile.cost_centre,
        employee_code: profile.employee_code,
      },
      db,
      { relay: false },
    );

    writeAdminAudit({
      actorUserId,
      action: "hr.employment.offboard",
      resourceType: "employment",
      resourceId: employmentId,
      companyId,
      changes: { end_date: endDate },
    });
  });

  run();
  void relayOnce(db);
  return { employmentId, status: "ended", endDate };
}
