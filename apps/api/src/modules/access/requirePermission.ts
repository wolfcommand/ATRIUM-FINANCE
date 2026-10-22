/**
 * Express gate that resolves the Wolf session, loads grants, and calls authorize().
 * Architecture §5.2 / §12: every protected endpoint goes through this (or an equivalent
 * that still calls authorize() — never inline role/email checks).
 */
import type { NextFunction, Request, Response } from "express";
import { parse as parseCookie } from "cookie";
import { authorize, type Grant } from "@wolf/access";
import { getDb } from "../../db/client.js";
import { SESSION_COOKIE, getActiveSession, type SessionRow } from "../identity/sessions.js";
import { loadGrants } from "../../routes/access.js";
import { getGrantsVersion } from "./grantsVersion.js";
import { writeAdminAudit } from "../admin/audit.js";

export type WolfAuth = {
  session: SessionRow;
  userId: string;
  grants: Grant[];
  grantsVersion: number;
  companyId?: string;
};

declare global {
  namespace Express {
    interface Request {
      wolfAuth?: WolfAuth;
    }
  }
}

export function resolveSessionFromRequest(req: Request): SessionRow | null {
  const headerId = String(req.headers["x-wolf-session-id"] ?? "").trim();
  if (headerId) return getActiveSession(getDb(), headerId);
  const raw = req.headers.cookie;
  const cookieId = raw ? parseCookie(raw)[SESSION_COOKIE] : null;
  if (!cookieId) return null;
  return getActiveSession(getDb(), cookieId);
}

export function attachWolfAuth(req: Request, session: SessionRow, companyId?: string): WolfAuth {
  const grants = loadGrants(session.user_id);
  const auth: WolfAuth = {
    session,
    userId: session.user_id,
    grants,
    grantsVersion: getGrantsVersion(session.user_id),
    companyId,
  };
  req.wolfAuth = auth;
  return auth;
}

/**
 * Middleware factory: require an active session and authorize(permission).
 * Optional companyId from header/query/body is attached for company-scoped grants.
 */
export function requirePermission(
  permission: string,
  opts?: {
    classification?: 0 | 1 | 2 | 3;
    resourceType?: string;
    auditOnDeny?: boolean;
    /** When true, require companyId in header/query/body. */
    requireCompany?: boolean;
  },
) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const session = resolveSessionFromRequest(req);
    if (!session) {
      res.status(401).json({ error: "unauthorized" });
      return;
    }
    const companyId = String(
      req.headers["x-wolf-company-id"] ?? req.query.companyId ?? req.body?.companyId ?? "",
    ).trim();
    if (opts?.requireCompany && !companyId) {
      res.status(400).json({ error: "company_id_required" });
      return;
    }
    const auth = attachWolfAuth(req, session, companyId || undefined);
    const decision = authorize(
      {
        userId: auth.userId,
        sessionId: auth.session.id,
        authLevel: auth.session.auth_level,
        authTime: new Date(auth.session.auth_time),
        companyId: auth.companyId,
      },
      permission,
      {
        type: opts?.resourceType ?? "api",
        companyId: auth.companyId,
        classification: opts?.classification ?? 1,
      },
      auth.grants,
    );
    if (!decision.allow) {
      if (opts?.auditOnDeny !== false) {
        writeAdminAudit({
          actorUserId: auth.userId,
          action: permission,
          resourceType: opts?.resourceType ?? "api",
          companyId: auth.companyId ?? null,
          outcome: "deny",
          changes: { reason: decision.reason, path: req.path },
        });
      }
      res.status(403).json({
        error: "forbidden",
        reason: decision.reason,
        permission,
        obligations: decision.obligations,
      });
      return;
    }
    if (decision.obligations.includes("log_read")) {
      writeAdminAudit({
        actorUserId: auth.userId,
        action: permission,
        resourceType: opts?.resourceType ?? "api",
        companyId: auth.companyId ?? null,
        outcome: "allow",
        changes: { path: req.path, obligation: "log_read" },
      });
    }
    next();
  };
}

/** Session required, no specific permission (identity bootstrap only). Prefer requirePermission. */
export function requireSession(req: Request, res: Response, next: NextFunction): void {
  const session = resolveSessionFromRequest(req);
  if (!session) {
    res.status(401).json({ error: "unauthorized" });
    return;
  }
  attachWolfAuth(req, session);
  next();
}
