/**
 * Event inject + relay + finance employee_ref read APIs.
 * All routes go through authorize() (Phase 1 Trust core).
 */
import { Router } from "express";
import { z } from "zod";
import { getDb } from "../db/client.js";
import { enqueueOutboxEvent, relayOnce } from "../modules/integration/outbox.js";
import {
  listDeadLetters,
  listEmployeeRefs,
} from "../modules/finance/employeeRefConsumer.js";
import { requirePermission } from "../modules/access/requirePermission.js";

const injectSchema = z.object({
  eventType: z.enum(["employee.created", "employee.updated", "employment.ended"]),
  employmentId: z.string().min(1),
  companyId: z.string().min(1),
  displayName: z.string().min(1),
  costCentre: z.string().optional(),
  idempotencyKey: z.string().min(1),
  version: z.number().int().positive().optional(),
});

export function eventsRouter() {
  const router = Router();

  router.post(
    "/v1/events/inject",
    requirePermission("integration.events.inject", {
      classification: 2,
      resourceType: "outbox",
    }),
    async (req, res) => {
      // Fake-data / staging only — blocked when WOLF_ALLOW_EVENT_INJECT=false
      if (process.env.WOLF_ALLOW_EVENT_INJECT === "false") {
        res.status(403).json({ error: "event_inject_disabled" });
        return;
      }
      const parsed = injectSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: "invalid_body", details: parsed.error.flatten() });
        return;
      }
      const b = parsed.data;
      const row = enqueueOutboxEvent({
        aggregateType: "employment",
        aggregateId: b.employmentId,
        eventType: b.eventType,
        version: b.version ?? 1,
        idempotencyKey: b.idempotencyKey,
        payload: {
          employment_id: b.employmentId,
          company_id: b.companyId,
          display_name: b.displayName,
          cost_centre: b.costCentre ?? null,
        },
      });
      res.status(201).json({ outbox: row });
    },
  );

  router.post(
    "/v1/events/relay",
    requirePermission("integration.events.relay", {
      classification: 1,
      resourceType: "outbox",
    }),
    async (_req, res) => {
      const result = await relayOnce(getDb());
      res.json(result);
    },
  );

  router.get(
    "/v1/finance/employee-refs",
    requirePermission("finance.employee_ref.read", {
      classification: 2,
      resourceType: "finance_employee_ref",
    }),
    (_req, res) => {
      res.json({ refs: listEmployeeRefs(getDb()) });
    },
  );

  router.get(
    "/v1/events/dead-letters",
    requirePermission("integration.events.read", {
      classification: 2,
      resourceType: "dead_letter",
    }),
    (_req, res) => {
      res.json({ deadLetters: listDeadLetters(getDb()) });
    },
  );

  return router;
}
