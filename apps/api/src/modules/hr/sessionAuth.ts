/**
 * Auth for /v1/hr/* — Wolf session via cookie or X-Wolf-Session-Id (Level-2 proxy).
 */
import type { Request, Response, NextFunction } from "express";
import { parse as parseCookie } from "cookie";
import { authorize, type Grant } from "@wolf/access";
import { getDb } from "../../db/client.js";
import { SESSION_COOKIE, getActiveSession, type SessionRow } from "../identity/sessions.js";
import { loadGrants } from "../../routes/access.js";

export type HrAuth = {
  session: SessionRow;
  userId: string;
  companyId: string;
  grants: Grant[];
};

export function resolveWolfSession(req: Request): SessionRow | null {
  const headerId = String(req.headers["x-wolf-session-id"] ?? "").trim();
  if (headerId) {
    return getActiveSession(getDb(), headerId);
  }
  const raw = req.headers.cookie;
  const cookieId = raw ? parseCookie(raw)[SESSION_COOKIE] : null;
  if (!cookieId) return null;
  return getActiveSession(getDb(), cookieId);
}

export function requireHrSession(req: Request, res: Response, next: NextFunction): void {
  const session = resolveWolfSession(req);
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
       WHERE user_id = ? AND company_id = ? AND app_key = 'hr'`,
    )
    .get(session.user_id, companyId) as { ok: number } | undefined;
  if (!entitled) {
    res.status(403).json({ error: "hr_not_entitled" });
    return;
  }
  const grants = loadGrants(session.user_id);
  (req as Request & { hrAuth: HrAuth }).hrAuth = {
    session,
    userId: session.user_id,
    companyId,
    grants,
  };
  next();
}

export function requireHrPermission(permission: string) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const auth = (req as Request & { hrAuth?: HrAuth }).hrAuth;
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
      { type: "hr", companyId: auth.companyId, classification: 2 },
      auth.grants,
    );
    if (!decision.allow) {
      res.status(403).json({ error: "forbidden", reason: decision.reason, permission });
      return;
    }
    next();
  };
}

export function getHrAuth(req: Request): HrAuth {
  return (req as Request & { hrAuth: HrAuth }).hrAuth;
}
