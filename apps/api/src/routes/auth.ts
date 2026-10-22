import { Router } from "express";
import { parse as parseCookie, serialize as serializeCookie } from "cookie";
import { z } from "zod";
import { getDb } from "../db/client.js";
import { verifyPassword } from "../lib/password.js";
import {
  SESSION_COOKIE,
  createSession,
  getActiveSession,
  revokeSession,
} from "../modules/identity/sessions.js";
import { buildMe } from "../modules/identity/me.js";
import { requirePermission } from "../modules/access/requirePermission.js";
import { getGrantsVersion } from "../modules/access/grantsVersion.js";

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

function readSessionId(req: { headers: { cookie?: string } }): string | null {
  const raw = req.headers.cookie;
  if (!raw) return null;
  return parseCookie(raw)[SESSION_COOKIE] ?? null;
}

function setSessionCookie(res: { setHeader: (k: string, v: string) => void }, sessionId: string) {
  res.setHeader(
    "Set-Cookie",
    serializeCookie(SESSION_COOKIE, sessionId, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 8,
    }),
  );
}

function clearSessionCookie(res: { setHeader: (k: string, v: string) => void }) {
  res.setHeader(
    "Set-Cookie",
    serializeCookie(SESSION_COOKIE, "", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 0,
    }),
  );
}

export function authRouter(): Router {
  const router = Router();

  router.post("/login", (req, res) => {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "invalid_body" });
      return;
    }
    const db = getDb();
    const user = db
      .prepare(`SELECT id, password_hash, status FROM users WHERE email = ?`)
      .get(parsed.data.email.toLowerCase()) as
      | { id: string; password_hash: string | null; status: string }
      | undefined;
    if (!user || user.status !== "active" || !user.password_hash) {
      res.status(401).json({ error: "invalid_credentials" });
      return;
    }
    if (!verifyPassword(parsed.data.password, user.password_hash)) {
      res.status(401).json({ error: "invalid_credentials" });
      return;
    }
    const session = createSession(db, user.id, {
      deviceInfo: String(req.headers["user-agent"] ?? "").slice(0, 200),
    });
    setSessionCookie(res, session.id);
    const me = buildMe(db, session);
    res.json({ ok: true, me });
  });

  router.post("/logout", (req, res) => {
    const db = getDb();
    const sessionId = readSessionId(req);
    if (sessionId) revokeSession(db, sessionId);
    clearSessionCookie(res);
    res.json({ ok: true });
  });

  router.post(
    "/sessions/:id/revoke",
    requirePermission("identity.session.revoke", {
      classification: 1,
      resourceType: "session",
      auditOnDeny: true,
    }),
    (req, res) => {
      const db = getDb();
      const auth = req.wolfAuth!;
      const target = db.prepare(`SELECT user_id FROM sessions WHERE id = ?`).get(req.params.id) as
        | { user_id: string }
        | undefined;
      if (!target || target.user_id !== auth.userId) {
        res.status(403).json({ error: "forbidden" });
        return;
      }
      const revoked = revokeSession(db, req.params.id);
      if (auth.session.id === req.params.id) clearSessionCookie(res);
      res.json({ ok: revoked });
    },
  );

  router.get(
    "/me",
    requirePermission("identity.me.read", {
      classification: 1,
      resourceType: "identity",
      auditOnDeny: false,
    }),
    (req, res) => {
      const db = getDb();
      const auth = req.wolfAuth!;
      const session = getActiveSession(db, auth.session.id);
      if (!session) {
        clearSessionCookie(res);
        res.status(401).json({ error: "session_revoked_or_missing" });
        return;
      }
      const me = buildMe(db, session);
      if (!me) {
        res.status(401).json({ error: "unauthorized" });
        return;
      }
      res.json({ ...me, grants_version: getGrantsVersion(auth.userId) });
    },
  );

  return router;
}

export { readSessionId, setSessionCookie, clearSessionCookie };
