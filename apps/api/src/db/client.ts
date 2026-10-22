import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";
import { DDL } from "./schema.js";

export type Db = Database.Database;

let singleton: Db | null = null;

export function getDbPath(override?: string): string {
  if (override) return override;
  if (process.env.WOLF_DB_PATH) return process.env.WOLF_DB_PATH;
  return path.join(process.cwd(), "data", "wolf.sqlite");
}

export function openDb(dbPath?: string): Db {
  const resolved = getDbPath(dbPath);
  fs.mkdirSync(path.dirname(resolved), { recursive: true });
  const db = new Database(resolved);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  db.exec(DDL);
  return db;
}

export function getDb(): Db {
  if (!singleton) singleton = openDb();
  return singleton;
}

export function resetDbForTests(dbPath: string): Db {
  if (fs.existsSync(dbPath)) fs.unlinkSync(dbPath);
  singleton = openDb(dbPath);
  return singleton;
}

export function setDb(db: Db): void {
  singleton = db;
}
