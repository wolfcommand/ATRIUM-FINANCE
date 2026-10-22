/**
 * Wolf portal handoff verification for Finance (Prompt 3).
 * Trust only short-lived JWTs issued by Wolf API (audience=finance).
 */
import { createRemoteJWKSet, jwtVerify } from "jose";
import type { Request, Response, NextFunction } from "express";
import { randomUUID } from "node:crypto";

export type FinanceSession = {
  id: string;
  userId: string;
  wolfSessionId: string;
  companyId: string;
  authLevel: number;
  authTime: string;
  createdAt: string;
};

const sessions = new Map<string, FinanceSession>();
const COOKIE = "finance_wolf_session";

function wolfApiOrigin(): string {
  return process.env.WOLF_API_ORIGIN ?? "http://127.0.0.1:4000";
}

function jwksUrl(): string {
  return process.env.WOLF_JWKS_URL ?? `${wolfApiOrigin()}/.well-known/jwks.json`;
}

let jwks = createRemoteJWKSet(new URL(jwksUrl()));

export function resetJwksForTests(url?: string): void {
  jwks = createRemoteJWKSet(new URL(url ?? jwksUrl()));
}

export function clearFinanceSessions(): void {
  sessions.clear();
}

function readCookie(req: Request, name: string): string | null {
  const raw = req.headers.cookie;
  if (!raw) return null;
  for (const part of raw.split(";")) {
    const [k, ...rest] = part.trim().split("=");
    if (k === name) return decodeURIComponent(rest.join("="));
  }
  return null;
}

export function getFinanceSession(req: Request): FinanceSession | null {
  const id = readCookie(req, COOKIE);
  if (!id) return null;
  return sessions.get(id) ?? null;
}

export async function exchangeHandoffToken(token: string): Promise<FinanceSession> {
  const { payload } = await jwtVerify(token, jwks, {
    issuer: "wolf-api",
    audience: "finance",
  });
  const userId = String(payload.user_id ?? "");
  const wolfSessionId = String(payload.session_id ?? "");
  const companyId = String(payload.company_id ?? "");
  const authLevel = Number(payload.auth_level ?? 1);
  const authTime = String(payload.auth_time ?? "");
  if (!userId || !wolfSessionId || !companyId) {
    throw new Error("invalid_claims");
  }

  const activeRes = await fetch(`${wolfApiOrigin()}/v1/sessions/${wolfSessionId}/active`);
  const activeBody = (await activeRes.json()) as { active?: boolean };
  if (!activeBody.active) {
    throw new Error("wolf_session_revoked");
  }

  const session: FinanceSession = {
    id: randomUUID(),
    userId,
    wolfSessionId,
    companyId,
    authLevel,
    authTime,
    createdAt: new Date().toISOString(),
  };
  sessions.set(session.id, session);
  return session;
}

export function setFinanceSessionCookie(res: Response, sessionId: string): void {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  res.setHeader(
    "Set-Cookie",
    `${COOKIE}=${encodeURIComponent(sessionId)}; Path=/; HttpOnly; SameSite=Lax${secure}`,
  );
}

export function clearFinanceSessionCookie(res: Response): void {
  res.setHeader("Set-Cookie", `${COOKIE}=; Path=/; HttpOnly; Max-Age=0; SameSite=Lax`);
}

export async function requireWolfSession(req: Request, res: Response, next: NextFunction) {
  if (req.path === "/api/health" || req.path === "/api/wolf/handoff" || req.path === "/api/wolf/session") {
    next();
    return;
  }
  if (!req.path.startsWith("/api/")) {
    next();
    return;
  }

  const session = getFinanceSession(req);
  if (!session) {
    res.status(401).json({ error: "wolf_session_required" });
    return;
  }

  try {
    const activeRes = await fetch(
      `${wolfApiOrigin()}/v1/sessions/${session.wolfSessionId}/active`,
    );
    const activeBody = (await activeRes.json()) as { active?: boolean };
    if (!activeBody.active) {
      sessions.delete(session.id);
      clearFinanceSessionCookie(res);
      res.status(401).json({ error: "wolf_session_revoked" });
      return;
    }
  } catch {
    res.status(503).json({ error: "wolf_session_check_failed" });
    return;
  }

  (req as Request & { wolfSession?: FinanceSession }).wolfSession = session;
  next();
}

export { COOKIE as FINANCE_SESSION_COOKIE, sessions as financeSessions };
