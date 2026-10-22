import type { Db } from "../../db/client.js";
import { getDb } from "../../db/client.js";
import { newId } from "../../lib/ids.js";

export function writeAdminAudit(
  input: {
    actorUserId: string | null;
    action: string;
    resourceType: string;
    resourceId?: string | null;
    companyId?: string | null;
    outcome?: "allow" | "deny";
    changes?: Record<string, unknown> | null;
  },
  db: Db = getDb(),
): void {
  db.prepare(
    `INSERT INTO audit_events (id, occurred_at, actor_user_id, action, resource_type, resource_id, company_id, outcome, changes)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    newId(),
    new Date().toISOString(),
    input.actorUserId,
    input.action,
    input.resourceType,
    input.resourceId ?? null,
    input.companyId ?? null,
    input.outcome ?? "allow",
    input.changes ? JSON.stringify(input.changes) : null,
  );
}

export function listAdminAudit(db: Db = getDb(), limit = 100) {
  return db
    .prepare(
      `SELECT id, occurred_at, actor_user_id, action, resource_type, resource_id, company_id, outcome, changes
       FROM audit_events ORDER BY occurred_at DESC LIMIT ?`,
    )
    .all(limit);
}
