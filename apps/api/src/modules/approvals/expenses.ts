import type { Db } from "../../db/client.js";
import { getDb } from "../../db/client.js";
import { newId } from "../../lib/ids.js";
import { submitApprovalRequest } from "./engine.js";

export function createAndSubmitExpense(input: {
  companyId: string;
  requesterUserId: string;
  amountMinor: number;
  currency: string;
  description: string;
  db?: Db;
}) {
  const db = input.db ?? getDb();
  const id = newId();
  db.prepare(
    `INSERT INTO expenses
      (id, company_id, requester_user_id, amount_minor, currency, description, status, approval_request_id, created_at)
     VALUES (?, ?, ?, ?, ?, ?, 'draft', NULL, ?)`,
  ).run(
    id,
    input.companyId,
    input.requesterUserId,
    input.amountMinor,
    input.currency,
    input.description,
    new Date().toISOString(),
  );

  const { requestId, snapshot } = submitApprovalRequest({
    companyId: input.companyId,
    requestType: "finance.expense",
    subjectId: id,
    requesterUserId: input.requesterUserId,
    amountMinor: input.amountMinor,
    currency: input.currency,
    db,
  });

  db.prepare(
    `UPDATE expenses SET status = 'submitted', approval_request_id = ? WHERE id = ?`,
  ).run(requestId, id);

  return { expenseId: id, requestId, snapshot };
}

export function listExpenses(companyId: string, db: Db = getDb()) {
  return db
    .prepare(
      `SELECT id, company_id, requester_user_id, amount_minor, currency, description, status, approval_request_id, created_at
       FROM expenses WHERE company_id = ? ORDER BY created_at DESC`,
    )
    .all(companyId);
}
