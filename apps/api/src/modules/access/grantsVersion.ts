/**
 * grants_version (architecture §5.3): bumped on every grant/role/employment change
 * so permission caches invalidate on the next request.
 */
import type { Db } from "../../db/client.js";
import { getDb } from "../../db/client.js";

export function getGrantsVersion(userId: string, db: Db = getDb()): number {
  const row = db.prepare(`SELECT grants_version FROM users WHERE id = ?`).get(userId) as
    | { grants_version: number }
    | undefined;
  return row?.grants_version ?? 0;
}

export function bumpGrantsVersion(userId: string, db: Db = getDb()): number {
  db.prepare(
    `UPDATE users SET grants_version = COALESCE(grants_version, 0) + 1 WHERE id = ?`,
  ).run(userId);
  return getGrantsVersion(userId, db);
}
