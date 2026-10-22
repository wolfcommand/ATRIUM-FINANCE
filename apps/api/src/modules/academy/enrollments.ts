import type { Db } from "../../db/client.js";
import { getDb } from "../../db/client.js";
import { newId } from "../../lib/ids.js";
import { writeAdminAudit } from "../admin/audit.js";

export function listMyEnrollments(userId: string, companyId: string | undefined, db: Db = getDb()) {
  if (companyId) {
    return db
      .prepare(
        `SELECT e.id, e.course_id, e.status, e.assigned_at, e.due_at, e.completed_at, e.company_id,
                c.code AS course_code, c.title AS course_title,
                p.percent AS progress_percent
         FROM academy_enrollments e
         JOIN academy_courses c ON c.id = e.course_id
         LEFT JOIN academy_progress p ON p.enrollment_id = e.id
         WHERE e.user_id = ? AND e.company_id = ?
         ORDER BY e.assigned_at DESC`,
      )
      .all(userId, companyId);
  }
  return db
    .prepare(
      `SELECT e.id, e.course_id, e.status, e.assigned_at, e.due_at, e.completed_at, e.company_id,
              c.code AS course_code, c.title AS course_title,
              p.percent AS progress_percent
       FROM academy_enrollments e
       JOIN academy_courses c ON c.id = e.course_id
       LEFT JOIN academy_progress p ON p.enrollment_id = e.id
       WHERE e.user_id = ?
       ORDER BY e.assigned_at DESC`,
    )
    .all(userId);
}

export function enrollFromCompanyAssignments(input: {
  userId: string;
  employmentId: string;
  companyId: string;
  sourceEventId: string;
  db?: Db;
}): number {
  const db = input.db ?? getDb();
  const assignments = db
    .prepare(
      `SELECT a.course_id, a.due_days
       FROM academy_assignments a
       WHERE a.target_type = 'company' AND a.target_id = ?`,
    )
    .all(input.companyId) as Array<{ course_id: string; due_days: number | null }>;

  let created = 0;
  const now = new Date();
  for (const a of assignments) {
    const version = db
      .prepare(
        `SELECT id FROM academy_course_versions WHERE course_id = ? ORDER BY version DESC LIMIT 1`,
      )
      .get(a.course_id) as { id: string } | undefined;
    if (!version) continue;

    const existing = db
      .prepare(
        `SELECT id FROM academy_enrollments WHERE course_id = ? AND employment_id = ?`,
      )
      .get(a.course_id, input.employmentId) as { id: string } | undefined;
    if (existing) continue;

    const enrollmentId = newId();
    const dueAt =
      a.due_days != null
        ? new Date(now.getTime() + a.due_days * 86400000).toISOString()
        : null;
    db.prepare(
      `INSERT INTO academy_enrollments
        (id, course_id, course_version_id, user_id, employment_id, company_id, status, assigned_at, due_at, completed_at, source_event_id)
       VALUES (?, ?, ?, ?, ?, ?, 'assigned', ?, ?, NULL, ?)`,
    ).run(
      enrollmentId,
      a.course_id,
      version.id,
      input.userId,
      input.employmentId,
      input.companyId,
      now.toISOString(),
      dueAt,
      input.sourceEventId,
    );
    db.prepare(
      `INSERT INTO academy_progress (id, enrollment_id, percent, last_position, updated_at)
       VALUES (?, ?, 0, NULL, ?)`,
    ).run(newId(), enrollmentId, now.toISOString());
    created += 1;
  }
  return created;
}

export function updateProgress(
  input: {
    enrollmentId: string;
    userId: string;
    percent: number;
    lastPosition?: string;
  },
  db: Db = getDb(),
) {
  const enrollment = db
    .prepare(`SELECT * FROM academy_enrollments WHERE id = ?`)
    .get(input.enrollmentId) as
    | {
        id: string;
        user_id: string;
        company_id: string;
        status: string;
      }
    | undefined;
  if (!enrollment || enrollment.user_id !== input.userId) {
    throw new Error("not_found");
  }
  const percent = Math.max(0, Math.min(100, Math.floor(input.percent)));
  const now = new Date().toISOString();
  db.prepare(
    `UPDATE academy_progress SET percent = ?, last_position = ?, updated_at = ? WHERE enrollment_id = ?`,
  ).run(percent, input.lastPosition ?? null, now, enrollment.id);

  let status = enrollment.status;
  if (percent >= 100) {
    status = "completed";
    db.prepare(
      `UPDATE academy_enrollments SET status = 'completed', completed_at = ? WHERE id = ?`,
    ).run(now, enrollment.id);
  } else if (percent > 0 && enrollment.status === "assigned") {
    status = "in_progress";
    db.prepare(`UPDATE academy_enrollments SET status = 'in_progress' WHERE id = ?`).run(
      enrollment.id,
    );
  }

  writeAdminAudit({
    actorUserId: input.userId,
    action: "academy.progress.update",
    resourceType: "academy_enrollment",
    resourceId: enrollment.id,
    companyId: enrollment.company_id,
    changes: { percent, status },
  });

  return { enrollmentId: enrollment.id, percent, status };
}
