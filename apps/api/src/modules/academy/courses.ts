import type { Db } from "../../db/client.js";
import { getDb } from "../../db/client.js";
import { newId } from "../../lib/ids.js";

export function listPublishedCourses(db: Db = getDb()) {
  return db
    .prepare(
      `SELECT c.id, c.code, c.title, c.summary, c.status,
              (SELECT MAX(v.version) FROM academy_course_versions v WHERE v.course_id = c.id) AS latest_version
       FROM academy_courses c
       WHERE c.status = 'published'
       ORDER BY c.title`,
    )
    .all();
}

export function getCourse(courseId: string, db: Db = getDb()) {
  const course = db
    .prepare(`SELECT id, code, title, summary, status FROM academy_courses WHERE id = ?`)
    .get(courseId) as
    | { id: string; code: string; title: string; summary: string; status: string }
    | undefined;
  if (!course) return null;
  const version = db
    .prepare(
      `SELECT id, version, content_md FROM academy_course_versions
       WHERE course_id = ? ORDER BY version DESC LIMIT 1`,
    )
    .get(courseId) as { id: string; version: number; content_md: string } | undefined;
  return { ...course, version: version ?? null };
}

export function ensureSeedCourses(db: Db = getDb()): void {
  const count = db.prepare(`SELECT COUNT(*) AS n FROM academy_courses`).get() as { n: number };
  if (count.n > 0) return;

  const courses = [
    {
      code: "WOLF-WELCOME",
      title: "Welcome to Wolf",
      summary: "Group orientation for every new hire.",
      content: "# Welcome\n\nFake onboarding content for Wolf Intelligence.",
    },
    {
      code: "WOLF-SECURITY",
      title: "Security basics",
      summary: "Passwords, phishing, and data handling.",
      content: "# Security\n\nNever share secrets. Fake training module.",
    },
  ];

  const now = new Date().toISOString();
  for (const c of courses) {
    const courseId = newId();
    db.prepare(
      `INSERT INTO academy_courses (id, code, title, summary, status, created_at)
       VALUES (?, ?, ?, ?, 'published', ?)`,
    ).run(courseId, c.code, c.title, c.summary, now);
    db.prepare(
      `INSERT INTO academy_course_versions (id, course_id, version, content_md, created_at)
       VALUES (?, ?, 1, ?, ?)`,
    ).run(newId(), courseId, c.content, now);
  }

  const companies = db.prepare(`SELECT id FROM companies`).all() as Array<{ id: string }>;
  const courseRows = db.prepare(`SELECT id FROM academy_courses`).all() as Array<{ id: string }>;
  for (const company of companies) {
    for (const course of courseRows) {
      const exists = db
        .prepare(
          `SELECT 1 AS ok FROM academy_assignments
           WHERE course_id = ? AND target_type = 'company' AND target_id = ?`,
        )
        .get(course.id, company.id);
      if (!exists) {
        db.prepare(
          `INSERT INTO academy_assignments (id, course_id, target_type, target_id, due_days, created_at)
           VALUES (?, ?, 'company', ?, 14, ?)`,
        ).run(newId(), course.id, company.id, now);
      }
    }
  }
}
