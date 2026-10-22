import type { Request, Response, NextFunction } from "express";
import { authorize, type Grant } from "@wolf/access";
import { getFinanceSession } from "./wolfAuth.js";
import { matchPermission } from "./permissionRegistry.js";

const grantCache = new Map<string, { grants: Grant[]; loadedAt: number }>();
const WOLF_API = () => process.env.WOLF_API_ORIGIN ?? "http://127.0.0.1:4000";

async function loadGrantsForUser(userId: string, wolfSessionId: string): Promise<Grant[]> {
  const cached = grantCache.get(userId);
  if (cached && Date.now() - cached.loadedAt < 30_000) return cached.grants;
  // Grants are resolved server-side via Wolf API using an internal session probe.
  // Finance passes wolf session id; API exposes grants for the session cookie path —
  // for Level-2 we fetch via a dedicated finance-facing grants lookup.
  const res = await fetch(`${WOLF_API()}/v1/access/grants-for-user/${userId}`, {
    headers: { "x-wolf-session-id": wolfSessionId },
  });
  if (!res.ok) return cached?.grants ?? [];
  const body = (await res.json()) as { grants: Grant[] };
  grantCache.set(userId, { grants: body.grants, loadedAt: Date.now() });
  return body.grants;
}

export function clearGrantCache(): void {
  grantCache.clear();
}

export async function requireAuthorized(req: Request, res: Response, next: NextFunction) {
  if (!req.path.startsWith("/api/")) {
    next();
    return;
  }
  // Health + handoff entry remain reachable without full authorize matrix
  if (
    req.path === "/api/health" ||
    req.path === "/api/wolf/handoff" ||
    req.path === "/api/wolf/session" ||
    req.path === "/api/wolf/logout"
  ) {
    next();
    return;
  }

  const session = getFinanceSession(req);
  if (!session) {
    res.status(401).json({ error: "wolf_session_required" });
    return;
  }

  const permission = matchPermission(req.method, req.path);
  if (!permission) {
    res.status(403).json({ error: "unguarded_route", path: req.path, method: req.method });
    return;
  }

  let grants: Grant[];
  try {
    grants = await loadGrantsForUser(session.userId, session.wolfSessionId);
  } catch {
    res.status(503).json({ error: "grants_unavailable" });
    return;
  }

  const decision = authorize(
    {
      userId: session.userId,
      sessionId: session.wolfSessionId,
      authLevel: session.authLevel,
      authTime: new Date(session.authTime),
      companyId: session.companyId,
    },
    permission,
    { type: "finance_route", companyId: session.companyId, classification: 2 },
    grants,
  );

  if (!decision.allow) {
    res.status(403).json({ error: "forbidden", reason: decision.reason, permission });
    return;
  }

  (req as Request & { wolfDecision?: typeof decision }).wolfDecision = decision;
  next();
}
