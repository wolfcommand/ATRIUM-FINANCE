import type { Request, Response } from "express";
import { parse as parseCookie } from "cookie";
import { getDb } from "../../db/client.js";
import { SESSION_COOKIE, getActiveSession } from "../identity/sessions.js";

export type AdminSession = {
  id: string;
  user_id: string;
  auth_level: number;
  email: string;
  display_name: string;
};

/** Owner / portal admin: seeded owner email or users with portal.admin grant. */
export function requireAdminSession(req: Request, res: Response): AdminSession | null {
  const raw = req.headers.cookie;
  const sessionId = raw ? parseCookie(raw)[SESSION_COOKIE] : null;
  if (!sessionId) {
    res.status(401).json({ error: "unauthorized" });
    return null;
  }
  const db = getDb();
  const session = getActiveSession(db, sessionId);
  if (!session) {
    res.status(401).json({ error: "unauthorized" });
    return null;
  }
  const user = db
    .prepare(`SELECT email, display_name FROM users WHERE id = ?`)
    .get(session.user_id) as { email: string; display_name: string } | undefined;
  if (!user) {
    res.status(401).json({ error: "unauthorized" });
    return null;
  }
  const isOwner = user.email === "owner@wolf.example";
  const hasGrant = db
    .prepare(
      `SELECT 1 AS ok FROM grants WHERE user_id = ? AND permission_key = 'portal.admin' AND (valid_to IS NULL OR valid_to > date('now'))`,
    )
    .get(session.user_id);
  if (!isOwner && !hasGrant) {
    res.status(403).json({ error: "forbidden", reason: "portal.admin_required" });
    return null;
  }
  return {
    id: session.id,
    user_id: session.user_id,
    auth_level: session.auth_level,
    email: user.email,
    display_name: user.display_name,
  };
}
