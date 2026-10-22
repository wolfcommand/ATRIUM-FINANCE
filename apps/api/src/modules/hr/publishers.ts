/**
 * HR → Finance event publishers (Prompt 7). Enqueues to transactional outbox.
 */
import type { Db } from "../../db/client.js";
import { getDb } from "../../db/client.js";
import { enqueueOutboxEvent, relayOnce } from "../integration/outbox.js";

export type EmployeeEventPayload = {
  employment_id: string;
  company_id: string;
  display_name: string;
  cost_centre?: string | null;
  employee_code?: string;
};

export function publishEmployeeCreated(
  payload: EmployeeEventPayload,
  db: Db = getDb(),
  opts?: { relay?: boolean },
): void {
  enqueueOutboxEvent(
    {
      aggregateType: "employment",
      aggregateId: payload.employment_id,
      eventType: "employee.created",
      version: 1,
      idempotencyKey: `employee.created:${payload.employment_id}`,
      payload: {
        employment_id: payload.employment_id,
        company_id: payload.company_id,
        display_name: payload.display_name,
        cost_centre: payload.cost_centre ?? null,
        employee_code: payload.employee_code ?? null,
      },
    },
    db,
  );
  if (opts?.relay !== false) {
    void relayOnce(db);
  }
}

export function publishEmployeeUpdated(
  payload: EmployeeEventPayload,
  db: Db = getDb(),
  opts?: { relay?: boolean },
): void {
  const stamp = new Date().toISOString();
  enqueueOutboxEvent(
    {
      aggregateType: "employment",
      aggregateId: payload.employment_id,
      eventType: "employee.updated",
      version: 1,
      idempotencyKey: `employee.updated:${payload.employment_id}:${stamp}`,
      payload: {
        employment_id: payload.employment_id,
        company_id: payload.company_id,
        display_name: payload.display_name,
        cost_centre: payload.cost_centre ?? null,
        employee_code: payload.employee_code ?? null,
      },
    },
    db,
  );
  if (opts?.relay !== false) {
    void relayOnce(db);
  }
}

export function publishEmploymentEnded(
  payload: EmployeeEventPayload,
  db: Db = getDb(),
  opts?: { relay?: boolean },
): void {
  enqueueOutboxEvent(
    {
      aggregateType: "employment",
      aggregateId: payload.employment_id,
      eventType: "employment.ended",
      version: 1,
      idempotencyKey: `employment.ended:${payload.employment_id}`,
      payload: {
        employment_id: payload.employment_id,
        company_id: payload.company_id,
        display_name: payload.display_name,
        cost_centre: payload.cost_centre ?? null,
        employee_code: payload.employee_code ?? null,
      },
    },
    db,
  );
  if (opts?.relay !== false) {
    void relayOnce(db);
  }
}
