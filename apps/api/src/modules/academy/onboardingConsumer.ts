/**
 * Academy consumer: on employee.created, enroll learner in company-assigned courses.
 * Cross-module via events only (architecture §7).
 */
import type { Db } from "../../db/client.js";
import { getDb } from "../../db/client.js";
import { subscribe, type WolfEvent } from "../integration/outbox.js";
import { ensureSeedCourses } from "./courses.js";
import { enrollFromCompanyAssignments } from "./enrollments.js";

export const ACADEMY_ONBOARDING_CONSUMER = "academy.onboarding";

function alreadyProcessed(db: Db, key: string): boolean {
  const row = db
    .prepare(
      `SELECT 1 AS ok FROM academy_consumer_processed WHERE idempotency_key = ? AND consumer = ?`,
    )
    .get(key, ACADEMY_ONBOARDING_CONSUMER) as { ok: number } | undefined;
  return Boolean(row);
}

function markProcessed(db: Db, key: string): void {
  db.prepare(
    `INSERT OR IGNORE INTO academy_consumer_processed (idempotency_key, consumer, processed_at)
     VALUES (?, ?, ?)`,
  ).run(key, ACADEMY_ONBOARDING_CONSUMER, new Date().toISOString());
}

function resolveUserId(db: Db, employmentId: string): string | null {
  const row = db
    .prepare(`SELECT user_id FROM employments WHERE id = ?`)
    .get(employmentId) as { user_id: string } | undefined;
  return row?.user_id ?? null;
}

async function handleEmployeeCreated(event: WolfEvent): Promise<void> {
  const db = getDb();
  if (alreadyProcessed(db, event.idempotencyKey)) return;
  ensureSeedCourses(db);

  const employmentId = String(event.payload.employment_id ?? "");
  const companyId = String(event.payload.company_id ?? "");
  if (!employmentId || !companyId) {
    markProcessed(db, event.idempotencyKey);
    return;
  }

  let userId = resolveUserId(db, employmentId);
  // Synthetic inject events may lack employments row — skip quietly
  if (!userId) {
    markProcessed(db, event.idempotencyKey);
    return;
  }

  enrollFromCompanyAssignments({
    userId,
    employmentId,
    companyId,
    sourceEventId: event.id,
    db,
  });
  markProcessed(db, event.idempotencyKey);
}

export function registerAcademyOnboardingConsumer(): () => void {
  const unsubs = [
    subscribe("employee.created", handleEmployeeCreated),
  ];
  return () => unsubs.forEach((u) => u());
}
