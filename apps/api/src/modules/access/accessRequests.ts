/**
 * Access-request helpers (Phase 2 shell): staff request add-ons; admin decides.
 */
import type { Db } from "../../db/client.js";
import { getDb } from "../../db/client.js";
import { newId } from "../../lib/ids.js";
import { bumpGrantsVersion } from "./grantsVersion.js";
import { writeAdminAudit } from "../admin/audit.js";

const APP_REQUEST_KEYS: Record<string, string> = {
  "app.finance": "finance",
  "app.hr": "hr",
};

export function createAccessRequest(
  input: {
    requesterUserId: string;
    companyId: string;
    permissionKey: string;
    reason: string;
  },
  db: Db = getDb(),
): { id: string } {
  const employment = db
    .prepare(
      `SELECT 1 AS ok FROM employments
       WHERE user_id = ? AND company_id = ? AND status = 'active'`,
    )
    .get(input.requesterUserId, input.companyId);
  if (!employment) {
    throw new Error("not_employed_in_company");
  }

  const pending = db
    .prepare(
      `SELECT id FROM access_requests
       WHERE requester_user_id = ? AND company_id = ? AND permission_key = ? AND status = 'pending'`,
    )
    .get(input.requesterUserId, input.companyId, input.permissionKey) as
    | { id: string }
    | undefined;
  if (pending) return { id: pending.id };

  const id = newId();
  db.prepare(
    `INSERT INTO access_requests (id, requester_user_id, company_id, permission_key, reason, status, created_at, decided_at, decided_by)
     VALUES (?, ?, ?, ?, ?, 'pending', ?, NULL, NULL)`,
  ).run(
    id,
    input.requesterUserId,
    input.companyId,
    input.permissionKey,
    input.reason,
    new Date().toISOString(),
  );
  writeAdminAudit({
    actorUserId: input.requesterUserId,
    action: "access_request.create",
    resourceType: "access_request",
    resourceId: id,
    companyId: input.companyId,
    changes: {
      permissionKey: input.permissionKey,
      reason: input.reason,
    },
  });
  return { id };
}

export function listMyAccessRequests(userId: string, db: Db = getDb()) {
  return db
    .prepare(
      `SELECT ar.*, c.code AS company_code
       FROM access_requests ar
       JOIN companies c ON c.id = ar.company_id
       WHERE ar.requester_user_id = ?
       ORDER BY ar.created_at DESC`,
    )
    .all(userId);
}

/** Apply approval side effects: grant + optional app entitlement. */
export function applyAccessRequestApproval(
  row: {
    id: string;
    requester_user_id: string;
    company_id: string;
    permission_key: string;
  },
  decidedBy: string,
  db: Db = getDb(),
): void {
  db.prepare(
    `INSERT OR IGNORE INTO permissions (key, description, default_classification) VALUES (?, ?, 2)`,
  ).run(row.permission_key, row.permission_key);

  const appKey = APP_REQUEST_KEYS[row.permission_key];
  if (appKey) {
    db.prepare(
      `INSERT OR IGNORE INTO app_entitlements (id, user_id, company_id, app_key)
       VALUES (?, ?, ?, ?)`,
    ).run(newId(), row.requester_user_id, row.company_id, appKey);
    // Ensure portal entitlement exists
    db.prepare(
      `INSERT OR IGNORE INTO app_entitlements (id, user_id, company_id, app_key)
       VALUES (?, ?, ?, 'portal')`,
    ).run(newId(), row.requester_user_id, row.company_id);

    const basePerms =
      appKey === "finance"
        ? ["finance.health.read", "finance.session.read", "finance.journal.read"]
        : ["hr.session.read", "hr.employee.read", "hr.self.read", "hr.leave.request"];
    for (const permissionKey of basePerms) {
      db.prepare(
        `INSERT OR IGNORE INTO permissions (key, description, default_classification) VALUES (?, ?, 2)`,
      ).run(permissionKey, permissionKey);
      const exists = db
        .prepare(
          `SELECT 1 AS ok FROM grants WHERE user_id = ? AND permission_key = ? AND scope_id = ?`,
        )
        .get(row.requester_user_id, permissionKey, row.company_id);
      if (!exists) {
        db.prepare(
          `INSERT INTO grants (id, user_id, role_id, permission_key, scope_type, scope_id, valid_from, valid_to, granted_by, reason, ticket_ref)
           VALUES (?, ?, NULL, ?, 'company', ?, date('now'), NULL, ?, 'access request approved', NULL)`,
        ).run(newId(), row.requester_user_id, permissionKey, row.company_id, decidedBy);
      }
    }
  } else {
    db.prepare(
      `INSERT INTO grants (id, user_id, role_id, permission_key, scope_type, scope_id, valid_from, valid_to, granted_by, reason, ticket_ref)
       VALUES (?, ?, NULL, ?, 'company', ?, date('now'), NULL, ?, 'access request approved', NULL)`,
    ).run(
      newId(),
      row.requester_user_id,
      row.permission_key,
      row.company_id,
      decidedBy,
    );
  }
  bumpGrantsVersion(row.requester_user_id, db);
}
