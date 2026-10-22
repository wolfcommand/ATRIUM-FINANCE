import type { Db } from "../../db/client.js";
import { newId } from "../../lib/ids.js";

export const SESSION_COOKIE = "wolf_session";

export type SessionRow = {
  id: string;
  user_id: string;
  created_at: string;
  last_seen_at: string;
  auth_level: number;
  auth_time: string;
  device_info: string | null;
  revoked_at: string | null;
};

export function createSession(
  db: Db,
  userId: string,
  opts?: { authLevel?: number; deviceInfo?: string },
): SessionRow {
  const now = new Date().toISOString();
  const row: SessionRow = {
    id: newId(),
    user_id: userId,
    created_at: now,
    last_seen_at: now,
    auth_level: opts?.authLevel ?? 1,
    auth_time: now,
    device_info: opts?.deviceInfo ?? null,
    revoked_at: null,
  };
  db.prepare(
    `INSERT INTO sessions (id, user_id, created_at, last_seen_at, auth_level, auth_time, device_info, revoked_at)
     VALUES (@id, @user_id, @created_at, @last_seen_at, @auth_level, @auth_time, @device_info, @revoked_at)`,
  ).run(row);
  return row;
}

export function getActiveSession(db: Db, sessionId: string): SessionRow | null {
  const row = db
    .prepare(`SELECT * FROM sessions WHERE id = ? AND revoked_at IS NULL`)
    .get(sessionId) as SessionRow | undefined;
  if (!row) return null;
  db.prepare(`UPDATE sessions SET last_seen_at = ? WHERE id = ?`).run(
    new Date().toISOString(),
    sessionId,
  );
  return row;
}

export function revokeSession(db: Db, sessionId: string): boolean {
  const result = db
    .prepare(`UPDATE sessions SET revoked_at = ? WHERE id = ? AND revoked_at IS NULL`)
    .run(new Date().toISOString(), sessionId);
  return result.changes > 0;
}

export function revokeAllUserSessions(db: Db, userId: string): number {
  const result = db
    .prepare(`UPDATE sessions SET revoked_at = ? WHERE user_id = ? AND revoked_at IS NULL`)
    .run(new Date().toISOString(), userId);
  return result.changes;
}
