/**
 * Finance employee_ref read model (Prompt 7).
 * Fed by employee.* events — no direct HR table access.
 * Lives in API process for Level-2; Finance app can query via /v1/finance/employee-refs.
 */
import type { Db } from "../../db/client.js";
import { getDb } from "../../db/client.js";
import type { BusMessage } from "./bus.js";
import { subscribe } from "./bus.js";
import { recordDeadLetter } from "./outbox.js";

export type EmployeeRef = {
  employment_id: string;
  company_id: string;
  display_name: string;
  cost_centre: string | null;
  status: "active" | "ended";
  updated_at: string;
};

const DDL = `
CREATE TABLE IF NOT EXISTS finance_employee_ref (
  employment_id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL,
  display_name TEXT NOT NULL,
  cost_centre TEXT,
  status TEXT NOT NULL CHECK (status IN ('active','ended')),
  updated_at TEXT NOT NULL
);
`;

export function ensureFinanceEmployeeRefTable(db: Db = getDb()): void {
  db.exec(DDL);
}

function alreadyProcessed(db: Db, outboxId: string, consumer: string): boolean {
  const row = db
    .prepare(`SELECT outbox_id FROM processed_events WHERE outbox_id = ? AND consumer = ?`)
    .get(outboxId, consumer) as { outbox_id: string } | undefined;
  return Boolean(row);
}

function markProcessed(db: Db, outboxId: string, consumer: string): void {
  db.prepare(
    `INSERT OR IGNORE INTO processed_events (outbox_id, consumer, processed_at) VALUES (?, ?, ?)`,
  ).run(outboxId, consumer, new Date().toISOString());
}

export function applyEmployeeEvent(db: Db, msg: BusMessage): void {
  ensureFinanceEmployeeRefTable(db);
  const consumer = "finance.employee_ref";
  if (alreadyProcessed(db, msg.outboxId, consumer)) return;

  const p = msg.payload;
  const employmentId = String(p.employment_id ?? "");
  const companyId = String(p.company_id ?? "");
  if (!employmentId || !companyId) {
    throw new Error("employee_event_missing_ids");
  }

  if (msg.type === "employee.created" || msg.type === "employee.updated") {
    const displayName = String(p.display_name ?? "Unknown");
    const costCentre = p.cost_centre != null ? String(p.cost_centre) : null;
    const status = (p.status === "ended" ? "ended" : "active") as "active" | "ended";
    const updatedAt = new Date().toISOString();
    db.prepare(
      `INSERT INTO finance_employee_ref (employment_id, company_id, display_name, cost_centre, status, updated_at)
       VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT(employment_id) DO UPDATE SET
         company_id = excluded.company_id,
         display_name = excluded.display_name,
         cost_centre = excluded.cost_centre,
         status = excluded.status,
         updated_at = excluded.updated_at`,
    ).run(employmentId, companyId, displayName, costCentre, status, updatedAt);
  } else if (msg.type === "employment.ended") {
    db.prepare(
      `UPDATE finance_employee_ref SET status = 'ended', updated_at = ? WHERE employment_id = ?`,
    ).run(new Date().toISOString(), employmentId);
  } else {
    throw new Error(`unsupported_event:${msg.type}`);
  }

  markProcessed(db, msg.outboxId, consumer);
}

export function listEmployeeRefs(db: Db = getDb(), companyId?: string): EmployeeRef[] {
  ensureFinanceEmployeeRefTable(db);
  if (companyId) {
    return db
      .prepare(
        `SELECT employment_id, company_id, display_name, cost_centre, status, updated_at
         FROM finance_employee_ref WHERE company_id = ? ORDER BY display_name`,
      )
      .all(companyId) as EmployeeRef[];
  }
  return db
    .prepare(
      `SELECT employment_id, company_id, display_name, cost_centre, status, updated_at
       FROM finance_employee_ref ORDER BY display_name`,
    )
    .all() as EmployeeRef[];
}

/** Register idempotent consumer; failures bubble to relay for DLQ. */
export function registerFinanceEmployeeRefConsumer(): void {
  const handler = async (msg: BusMessage) => {
    if (
      msg.type !== "employee.created" &&
      msg.type !== "employee.updated" &&
      msg.type !== "employment.ended"
    ) {
      return;
    }
    applyEmployeeEvent(getDb(), msg);
  };
  subscribe("employee.created", handler);
  subscribe("employee.updated", handler);
  subscribe("employment.ended", handler);
}

/** Force a poison payload into DLQ path for tests (handler that always throws). */
export function registerFailingConsumerForTests(type: string): void {
  subscribe(type, async () => {
    throw new Error("forced_consumer_failure");
  });
}

export function deadLetterFromConsumer(
  outboxId: string,
  type: string,
  payload: Record<string, unknown>,
  error: string,
): void {
  recordDeadLetter(getDb(), { outboxId, type, payload, error });
}
