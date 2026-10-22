import { Router } from "express";
import { parse as parseCookie } from "cookie";
import { authorize, type Grant } from "@wolf/access";
import { z } from "zod";
import { getDb } from "../db/client.js";
import { SESSION_COOKIE, getActiveSession } from "../modules/identity/sessions.js";

const bodySchema = z.object({
  action: z.string().min(1),
  companyId: z.string().optional(),
  resource: z
    .object({
      type: z.string(),
      id: z.string().optional(),
      companyId: z.string().optional(),
      ownerUserId: z.string().optional(),
      classification: z.union([z.literal(0), z.literal(1), z.literal(2), z.literal(3)]).optional(),
    })
    .optional(),
});

function loadGrants(userId: string): Grant[] {
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT permission_key, scope_type, scope_id, valid_from, valid_to
       FROM grants WHERE user_id = ? AND permission_key IS NOT NULL`,
    )
    .all(userId) as Array<{
    permission_key: string;
    scope_type: Grant["scopeType"];
    scope_id: string | null;
    valid_from: string;
    valid_to: string | null;
  }>;
  return rows.map((r) => ({
    permissionKey: r.permission_key,
    scopeType: r.scope_type,
    scopeId: r.scope_id,
    validFrom: r.valid_from,
    validTo: r.valid_to,
  }));
}

export function accessRouter(): Router {
  const router = Router();

  router.get("/v1/access/grants", (req, res) => {
    const raw = req.headers.cookie;
    const sessionId = raw ? parseCookie(raw)[SESSION_COOKIE] : null;
    if (!sessionId) {
      res.status(401).json({ error: "unauthorized" });
      return;
    }
    const session = getActiveSession(getDb(), sessionId);
    if (!session) {
      res.status(401).json({ error: "unauthorized" });
      return;
    }
    res.json({ grants: loadGrants(session.user_id) });
  });

  /** Finance service lookup: requires active Wolf session id header matching the user. */
  router.get("/v1/access/grants-for-user/:userId", (req, res) => {
    const wolfSessionId = String(req.headers["x-wolf-session-id"] ?? "");
    if (!wolfSessionId) {
      res.status(401).json({ error: "unauthorized" });
      return;
    }
    const session = getActiveSession(getDb(), wolfSessionId);
    if (!session || session.user_id !== req.params.userId) {
      res.status(401).json({ error: "unauthorized" });
      return;
    }
    res.json({ grants: loadGrants(session.user_id) });
  });

  router.post("/v1/access/authorize", (req, res) => {
    const raw = req.headers.cookie;
    const sessionId = raw ? parseCookie(raw)[SESSION_COOKIE] : null;
    if (!sessionId) {
      res.status(401).json({ error: "unauthorized" });
      return;
    }
    const session = getActiveSession(getDb(), sessionId);
    if (!session) {
      res.status(401).json({ error: "unauthorized" });
      return;
    }
    const parsed = bodySchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "invalid_body" });
      return;
    }
    const grants = loadGrants(session.user_id);
    const decision = authorize(
      {
        userId: session.user_id,
        sessionId: session.id,
        authLevel: session.auth_level,
        authTime: new Date(session.auth_time),
        companyId: parsed.data.companyId,
      },
      parsed.data.action,
      parsed.data.resource ??
        (parsed.data.companyId
          ? { type: "company", companyId: parsed.data.companyId }
          : undefined),
      grants,
    );
    res.json(decision);
  });

  return router;
}

export { loadGrants };
