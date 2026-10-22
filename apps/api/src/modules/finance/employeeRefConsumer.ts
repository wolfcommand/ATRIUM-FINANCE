/**
 * Finance employee_ref read model consumer (Prompt 7 partial).
 * Idempotent; failed handlers write dead_letter_events.
 * No HR publishers — synthetic events used in tests / admin inject.
 */
import type { Db } from "../../db/client.js";
import { getDb } from "../../db/client.js";
import { newId } from "../../lib/ids.js";
import { subscribe, type WolfEvent } from "../integration/outbox.js";

export const FINANCE_EMPLOYEE_REF_CONSUMER = "finance.employee_ref";

export type EmployeeRef = {
  employment_id: string;
  company_id: string;
  display_name: string;
  cost_centre: string | null;
  status: "active" | "ended";
  source_event_id: string;
  updated_at: string;
};

let failNext = false;

/** Test hook: force the next consume to throw (for DLQ coverage). */
export function failNextEmployeeRefConsume(): void {
  failNext = true;
}

export function resetEmployeeRefConsumerForTests(): void {
  failNext = false;
}

function alreadyProcessed(db: Db, key: string): boolean {
  const row = db
    .prepare(
      `SELECT 1 AS ok FROM finance_consumer_processed WHERE idempotency_key = ? AND consumer = ?`,
    )
    .get(key, FINANCE_EMPLOYEE_REF_CONSUMER) as { ok: number } | undefined;
  return Boolean(row);
}

function markProcessed(db: Db, key: string): void {
  db.prepare(
    `INSERT OR IGNORE INTO finance_consumer_processed (idempotency_key, consumer, processed_at)
     VALUES (?, ?, ?)`,
  ).run(key, FINANCE_EMPLOYEE_REF_CONSUMER, new Date().toISOString());
}

function writeDeadLetter(db: Db, event: WolfEvent, error: unknown): void {
  db.prepare(
    `INSERT INTO dead_letter_events
      (id, outbox_id, event_type, event_version, payload, error_message, failed_at, consumer)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    newId(),
    event.id,
    event.type,
    event.version,
    JSON.stringify(event.payload),
    error instanceof Error ? error.message : String(error),
    new Date().toISOString(),
    FINANCE_EMPLOYEE_REF_CONSUMER,
  );
}

function upsertRef(db: Db, event: WolfEvent, status: "active" | "ended"): void {
  const employmentId = String(event.payload.employment_id ?? event.aggregateId);
  const companyId = String(event.payload.company_id ?? "");
  const displayName = String(event.payload.display_name ?? "");
  const costCentre =
    event.payload.cost_centre === undefined || event.payload.cost_centre === null
      ? null
      : String(event.payload.cost_centre);
  if (!employmentId || !companyId || !displayName) {
    throw new Error("invalid_employee_ref_payload");
  }
  const now = new Date().toISOString();
  db.prepare(
    `INSERT INTO finance_employee_ref
      (employment_id, company_id, display_name, cost_centre, status, source_event_id, updated_at)
     VALUES (@employment_id, @company_id, @display_name, @cost_centre, @status, @source_event_id, @updated_at)
     ON CONFLICT(employment_id) DO UPDATE SET
       company_id = excluded.company_id,
       display_name = excluded.display_name,
       cost_centre = excluded.cost_centre,
       status = excluded.status,
       source_event_id = excluded.source_event_id,
       updated_at = excluded.updated_at`,
  ).run({
    employment_id: employmentId,
    company_id: companyId,
    display_name: displayName,
    cost_centre: costCentre,
    status,
    source_event_id: event.id,
    updated_at: now,
  });
}

export async function handleFinanceEmployeeEvent(
  event: WolfEvent,
  db: Db = getDb(),
): Promise<void> {
  if (
    event.type !== "employee.created" &&
    event.type !== "employee.updated" &&
    event.type !== "employment.ended"
  ) {
    return;
  }

  const processKey = `${FINANCE_EMPLOYEE_REF_CONSUMER}:${event.idempotencyKey}`;
  if (alreadyProcessed(db, processKey)) return;

  try {
    if (failNext) {
      failNext = false;
      throw new Error("forced_consumer_failure");
    }
    if (event.type === "employment.ended") {
      upsertRef(db, event, "ended");
    } else {
      upsertRef(db, event, "active");
    }
    markProcessed(db, processKey);
  } catch (err) {
    writeDeadLetter(db, event, err);
    // Do not mark processed — allows replay after fix; DLQ records the failure
  }
}

export function registerFinanceEmployeeRefConsumer(): () => void {
  const unsubs = [
    subscribe("employee.created", (e) => handleFinanceEmployeeEvent(e)),
    subscribe("employee.updated", (e) => handleFinanceEmployeeEvent(e)),
    subscribe("employment.ended", (e) => handleFinanceEmployeeEvent(e)),
  ];
  return () => unsubs.forEach((u) => u());
}

export function listEmployeeRefs(db: Db = getDb()): EmployeeRef[] {
  return db
    .prepare(`SELECT * FROM finance_employee_ref ORDER BY updated_at DESC`)
    .all() as EmployeeRef[];
}

export function listDeadLetters(db: Db = getDb()) {
  return db
    .prepare(`SELECT * FROM dead_letter_events ORDER BY failed_at DESC`)
    .all() as Array<{
    id: string;
    outbox_id: string;
    event_type: string;
    error_message: string;
    consumer: string;
  }>;
}
