/**
 * Core approval engine (architecture §9.5).
 * Policies are data; submitted requests keep a chain_snapshot so later edits never rewrite history.
 */
import type { Db } from "../../db/client.js";
import { getDb } from "../../db/client.js";
import { newId } from "../../lib/ids.js";
import { writeAdminAudit } from "../admin/audit.js";
import { enqueueOutboxEvent, relayOnce } from "../integration/outbox.js";

export type PolicyStep = {
  step_no: number;
  approver_rule: string;
  amount_threshold_minor: number | null;
};

export type ChainSnapshot = {
  policy_id: string;
  policy_version: number;
  request_type: string;
  steps: PolicyStep[];
  snapshotted_at: string;
};

export function ensureDefaultExpensePolicies(db: Db = getDb()): void {
  const companies = db.prepare(`SELECT id FROM companies`).all() as Array<{ id: string }>;
  const now = new Date().toISOString();
  for (const c of companies) {
    const existing = db
      .prepare(
        `SELECT id FROM approval_policies
         WHERE company_id = ? AND request_type = 'finance.expense' AND valid_to IS NULL
         ORDER BY version DESC LIMIT 1`,
      )
      .get(c.id) as { id: string } | undefined;
    if (existing) continue;
    const policyId = newId();
    db.prepare(
      `INSERT INTO approval_policies (id, company_id, request_type, version, valid_from, valid_to, created_at)
       VALUES (?, ?, 'finance.expense', 1, ?, NULL, ?)`,
    ).run(policyId, c.id, now, now);
    db.prepare(
      `INSERT INTO approval_policy_steps (id, policy_id, step_no, approver_rule, amount_threshold_minor)
       VALUES (?, ?, 1, 'direct_manager', NULL)`,
    ).run(newId(), policyId);
    db.prepare(
      `INSERT INTO approval_policy_steps (id, policy_id, step_no, approver_rule, amount_threshold_minor)
       VALUES (?, ?, 2, 'finance_controller', 500000000)`,
    ).run(newId(), policyId); // 5_000_000.00 IDR in minor units example
  }
}

export function resolvePolicy(
  companyId: string,
  requestType: string,
  db: Db = getDb(),
  at = new Date(),
): { policyId: string; version: number; steps: PolicyStep[] } {
  ensureDefaultExpensePolicies(db);
  const atIso = at.toISOString();
  const policy = db
    .prepare(
      `SELECT id, version FROM approval_policies
       WHERE company_id = ? AND request_type = ?
         AND valid_from <= ? AND (valid_to IS NULL OR valid_to > ?)
       ORDER BY version DESC LIMIT 1`,
    )
    .get(companyId, requestType, atIso, atIso) as
    | { id: string; version: number }
    | undefined;
  if (!policy) throw new Error("policy_not_found");
  const steps = db
    .prepare(
      `SELECT step_no, approver_rule, amount_threshold_minor
       FROM approval_policy_steps WHERE policy_id = ? ORDER BY step_no`,
    )
    .all(policy.id) as PolicyStep[];
  return { policyId: policy.id, version: policy.version, steps };
}

/** Active steps for an amount (skip steps whose threshold is above amount). */
export function activeStepsForAmount(steps: PolicyStep[], amountMinor: number | null): PolicyStep[] {
  return steps.filter((s) => {
    if (s.amount_threshold_minor == null) return true;
    if (amountMinor == null) return true;
    return amountMinor >= s.amount_threshold_minor;
  });
}

export function submitApprovalRequest(input: {
  companyId: string;
  requestType: string;
  subjectId: string;
  requesterUserId: string;
  amountMinor?: number | null;
  currency?: string | null;
  db?: Db;
}): { requestId: string; snapshot: ChainSnapshot } {
  const db = input.db ?? getDb();
  const resolved = resolvePolicy(input.companyId, input.requestType, db);
  const steps = activeStepsForAmount(resolved.steps, input.amountMinor ?? null);
  if (steps.length === 0) throw new Error("no_applicable_steps");

  const snapshot: ChainSnapshot = {
    policy_id: resolved.policyId,
    policy_version: resolved.version,
    request_type: input.requestType,
    steps,
    snapshotted_at: new Date().toISOString(),
  };

  const requestId = newId();
  db.prepare(
    `INSERT INTO approval_requests
      (id, company_id, request_type, subject_id, requester_user_id, policy_id, policy_version,
       chain_snapshot, amount_minor, currency, status, current_step, created_at, decided_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', 1, ?, NULL)`,
  ).run(
    requestId,
    input.companyId,
    input.requestType,
    input.subjectId,
    input.requesterUserId,
    resolved.policyId,
    resolved.version,
    JSON.stringify(snapshot),
    input.amountMinor ?? null,
    input.currency ?? null,
    new Date().toISOString(),
  );

  for (const step of steps) {
    db.prepare(
      `INSERT INTO approval_steps (id, request_id, step_no, approver_user_id, status, decided_at, comment)
       VALUES (?, ?, ?, NULL, 'waiting', NULL, NULL)`,
    ).run(newId(), requestId, step.step_no);
  }

  writeAdminAudit({
    actorUserId: input.requesterUserId,
    action: "approval.request.submit",
    resourceType: "approval_request",
    resourceId: requestId,
    companyId: input.companyId,
    changes: { requestType: input.requestType, policyVersion: resolved.version },
  });

  return { requestId, snapshot };
}

export function listInbox(companyId: string, db: Db = getDb()) {
  return db
    .prepare(
      `SELECT r.*, u.email AS requester_email, u.display_name AS requester_name
       FROM approval_requests r
       JOIN users u ON u.id = r.requester_user_id
       WHERE r.company_id = ? AND r.status = 'pending'
       ORDER BY r.created_at ASC`,
    )
    .all(companyId);
}

export function getApprovalRequest(id: string, db: Db = getDb()) {
  return db.prepare(`SELECT * FROM approval_requests WHERE id = ?`).get(id) as
    | Record<string, unknown>
    | undefined;
}

export function decideApprovalStep(input: {
  requestId: string;
  actorUserId: string;
  decision: "approved" | "denied";
  comment?: string;
  db?: Db;
  relay?: boolean;
}): { status: string; currentStep: number } {
  const db = input.db ?? getDb();
  const row = db.prepare(`SELECT * FROM approval_requests WHERE id = ?`).get(input.requestId) as
    | {
        id: string;
        company_id: string;
        request_type: string;
        subject_id: string;
        status: string;
        current_step: number;
        chain_snapshot: string;
        requester_user_id: string;
        amount_minor: number | null;
        currency: string | null;
      }
    | undefined;
  if (!row || row.status !== "pending") throw new Error("not_pending");

  const snapshot = JSON.parse(row.chain_snapshot) as ChainSnapshot;
  const waiting = db
    .prepare(
      `SELECT id, step_no FROM approval_steps
       WHERE request_id = ? AND status = 'waiting' ORDER BY step_no LIMIT 1`,
    )
    .get(row.id) as { id: string; step_no: number } | undefined;
  if (!waiting) throw new Error("no_waiting_step");

  const now = new Date().toISOString();
  db.prepare(
    `UPDATE approval_steps SET status = ?, approver_user_id = ?, decided_at = ?, comment = ? WHERE id = ?`,
  ).run(input.decision, input.actorUserId, now, input.comment ?? null, waiting.id);

  if (input.decision === "denied") {
    db.prepare(
      `UPDATE approval_requests SET status = 'denied', decided_at = ? WHERE id = ?`,
    ).run(now, row.id);
    if (row.request_type === "finance.expense") {
      db.prepare(`UPDATE expenses SET status = 'denied' WHERE id = ?`).run(row.subject_id);
    }
    writeAdminAudit({
      actorUserId: input.actorUserId,
      action: "approval.request.deny",
      resourceType: "approval_request",
      resourceId: row.id,
      companyId: row.company_id,
      changes: { step: waiting.step_no },
    });
    return { status: "denied", currentStep: waiting.step_no };
  }

  const next = db
    .prepare(
      `SELECT step_no FROM approval_steps
       WHERE request_id = ? AND status = 'waiting' ORDER BY step_no LIMIT 1`,
    )
    .get(row.id) as { step_no: number } | undefined;

  if (next) {
    db.prepare(`UPDATE approval_requests SET current_step = ? WHERE id = ?`).run(
      next.step_no,
      row.id,
    );
    writeAdminAudit({
      actorUserId: input.actorUserId,
      action: "approval.step.approve",
      resourceType: "approval_request",
      resourceId: row.id,
      companyId: row.company_id,
      changes: { step: waiting.step_no, next: next.step_no },
    });
    return { status: "pending", currentStep: next.step_no };
  }

  db.prepare(
    `UPDATE approval_requests SET status = 'approved', decided_at = ?, current_step = ? WHERE id = ?`,
  ).run(now, waiting.step_no, row.id);
  if (row.request_type === "finance.expense") {
    db.prepare(`UPDATE expenses SET status = 'approved' WHERE id = ?`).run(row.subject_id);
    enqueueOutboxEvent(
      {
        aggregateType: "expense",
        aggregateId: row.subject_id,
        eventType: "expense.approved",
        version: 1,
        idempotencyKey: `expense.approved:${row.subject_id}`,
        payload: {
          expense_id: row.subject_id,
          company_id: row.company_id,
          amount_minor: row.amount_minor,
          currency: row.currency,
          approval_request_id: row.id,
          policy_version: snapshot.policy_version,
        },
      },
      db,
    );
    if (input.relay !== false) void relayOnce(db);
  }

  writeAdminAudit({
    actorUserId: input.actorUserId,
    action: "approval.request.approve",
    resourceType: "approval_request",
    resourceId: row.id,
    companyId: row.company_id,
    changes: { finalStep: waiting.step_no, policyVersion: snapshot.policy_version },
  });
  return { status: "approved", currentStep: waiting.step_no };
}

/** Bump policy version (new version); does not rewrite in-flight snapshots. */
export function publishNewPolicyVersion(input: {
  companyId: string;
  requestType: string;
  steps: Array<{ step_no: number; approver_rule: string; amount_threshold_minor?: number | null }>;
  actorUserId: string;
  db?: Db;
}): { policyId: string; version: number } {
  const db = input.db ?? getDb();
  const current = db
    .prepare(
      `SELECT id, version FROM approval_policies
       WHERE company_id = ? AND request_type = ? AND valid_to IS NULL
       ORDER BY version DESC LIMIT 1`,
    )
    .get(input.companyId, input.requestType) as { id: string; version: number } | undefined;

  const now = new Date().toISOString();
  if (current) {
    db.prepare(`UPDATE approval_policies SET valid_to = ? WHERE id = ?`).run(now, current.id);
  }
  const version = (current?.version ?? 0) + 1;
  const policyId = newId();
  db.prepare(
    `INSERT INTO approval_policies (id, company_id, request_type, version, valid_from, valid_to, created_at)
     VALUES (?, ?, ?, ?, ?, NULL, ?)`,
  ).run(policyId, input.companyId, input.requestType, version, now, now);
  for (const s of input.steps) {
    db.prepare(
      `INSERT INTO approval_policy_steps (id, policy_id, step_no, approver_rule, amount_threshold_minor)
       VALUES (?, ?, ?, ?, ?)`,
    ).run(newId(), policyId, s.step_no, s.approver_rule, s.amount_threshold_minor ?? null);
  }
  writeAdminAudit({
    actorUserId: input.actorUserId,
    action: "approval.policy.publish",
    resourceType: "approval_policy",
    resourceId: policyId,
    companyId: input.companyId,
    changes: { version, requestType: input.requestType },
  });
  return { policyId, version };
}
