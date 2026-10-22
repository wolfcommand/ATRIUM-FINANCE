import { Router } from "express";
import { getDb } from "../db/client.js";
import { enqueueOutbox, listDeadLetters } from "../modules/events/outbox.js";
import { relayOnce } from "../modules/events/relay.js";
import { listEmployeeRefs } from "../modules/events/financeEmployeeRef.js";

/**
 * Prompt 7: event inspection + fake enqueue (no HR publishers).
 * Enqueue is for CI/dev simulation of HR → Finance events only.
 */
export function eventsRouter() {
  const r = Router();

  r.post("/v1/events/enqueue-fake", (req, res) => {
    if (process.env.NODE_ENV === "production" && process.env.WOLF_ALLOW_FAKE_EVENTS !== "1") {
      res.status(403).json({ error: "fake_events_disabled" });
      return;
    }
    const { aggregate, type, payload, version } = req.body ?? {};
    if (!aggregate || !type || !payload) {
      res.status(400).json({ error: "aggregate_type_payload_required" });
      return;
    }
    const evt = enqueueOutbox(getDb(), {
      aggregate: String(aggregate),
      type: String(type),
      payload: payload as Record<string, unknown>,
      version: version ? Number(version) : 1,
    });
    res.status(201).json(evt);
  });

  r.post("/v1/events/relay", async (_req, res) => {
    const result = await relayOnce();
    res.json(result);
  });

  r.get("/v1/events/dead-letters", (_req, res) => {
    res.json({ items: listDeadLetters() });
  });

  r.get("/v1/finance/employee-refs", (req, res) => {
    const companyId = req.query.company_id ? String(req.query.company_id) : undefined;
    res.json({ items: listEmployeeRefs(getDb(), companyId) });
  });

  return r;
}
