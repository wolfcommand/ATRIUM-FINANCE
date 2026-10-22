import type { Request, Response, NextFunction } from "express";
import { authorize, type Grant } from "@wolf/access";
import {
  resolveSessionFromRequest,
  attachWolfAuth,
} from "../access/requirePermission.js";
import { loadGrants } from "../../routes/access.js";
import { getDb } from "../../db/client.js";
import type { SessionRow } from "../identity/sessions.js";

export type AcademyAuth = {
  session: SessionRow;
  userId: string;
  companyId: string;
  grants: Grant[];
};

export function requireAcademySession(req: Request, res: Response, next: NextFunction): void {
  const session = resolveSessionFromRequest(req);
  if (!session) {
    res.status(401).json({ error: "unauthorized" });
    return;
  }
  const companyId = String(
    req.headers["x-wolf-company-id"] ?? req.query.companyId ?? req.body?.companyId ?? "",
  ).trim();
  if (!companyId) {
    res.status(400).json({ error: "company_id_required" });
    return;
  }
  const entitled = getDb()
    .prepare(
      `SELECT 1 AS ok FROM app_entitlements
       WHERE user_id = ? AND company_id = ? AND app_key = 'academy'`,
    )
    .get(session.user_id, companyId) as { ok: number } | undefined;
  if (!entitled) {
    res.status(403).json({ error: "academy_not_entitled" });
    return;
  }
  const grants = loadGrants(session.user_id);
  attachWolfAuth(req, session, companyId);
  (req as Request & { academyAuth: AcademyAuth }).academyAuth = {
    session,
    userId: session.user_id,
    companyId,
    grants,
  };
  next();
}

export function requireAcademyPermission(permission: string) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const auth = (req as Request & { academyAuth?: AcademyAuth }).academyAuth;
    if (!auth) {
      res.status(401).json({ error: "unauthorized" });
      return;
    }
    const decision = authorize(
      {
        userId: auth.userId,
        sessionId: auth.session.id,
        authLevel: auth.session.auth_level,
        authTime: new Date(auth.session.auth_time),
        companyId: auth.companyId,
      },
      permission,
      { type: "academy", companyId: auth.companyId, classification: 1 },
      auth.grants,
    );
    if (!decision.allow) {
      res.status(403).json({ error: "forbidden", reason: decision.reason, permission });
      return;
    }
    next();
  };
}

export function getAcademyAuth(req: Request): AcademyAuth {
  return (req as Request & { academyAuth: AcademyAuth }).academyAuth;
}
