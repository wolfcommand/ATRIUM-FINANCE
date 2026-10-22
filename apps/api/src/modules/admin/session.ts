import type { Request, Response } from "express";
import { authorize } from "@wolf/access";
import { getDb } from "../../db/client.js";
import {
  attachWolfAuth,
  resolveSessionFromRequest,
} from "../access/requirePermission.js";
import { writeAdminAudit } from "./audit.js";

export type AdminSession = {
  id: string;
  user_id: string;
  auth_level: number;
  email: string;
  display_name: string;
  grantsVersion: number;
};

/**
 * Portal admin gate — authorize(portal.admin) only (architecture §5.2 / §12).
 * No inline email/role bypass.
 */
export function requireAdminSession(req: Request, res: Response): AdminSession | null {
  const session = resolveSessionFromRequest(req);
  if (!session) {
    res.status(401).json({ error: "unauthorized" });
    return null;
  }
  const auth = attachWolfAuth(req, session);
  const decision = authorize(
    {
      userId: auth.userId,
      sessionId: auth.session.id,
      authLevel: auth.session.auth_level,
      authTime: new Date(auth.session.auth_time),
    },
    "portal.admin",
    { type: "admin", classification: 2 },
    auth.grants,
  );
  if (!decision.allow) {
    writeAdminAudit({
      actorUserId: auth.userId,
      action: "portal.admin",
      resourceType: "admin",
      outcome: "deny",
      changes: { reason: decision.reason, path: req.path },
    });
    res.status(403).json({
      error: "forbidden",
      reason: decision.reason,
      permission: "portal.admin",
    });
    return null;
  }

  const user = getDb()
    .prepare(`SELECT email, display_name FROM users WHERE id = ?`)
    .get(session.user_id) as { email: string; display_name: string } | undefined;
  if (!user) {
    res.status(401).json({ error: "unauthorized" });
    return null;
  }
  return {
    id: session.id,
    user_id: session.user_id,
    auth_level: session.auth_level,
    email: user.email,
    display_name: user.display_name,
    grantsVersion: auth.grantsVersion,
  };
}
