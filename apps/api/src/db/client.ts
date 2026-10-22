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

/** Dev-only SQLite ALTER helpers when CREATE IF NOT EXISTS cannot add columns. */
function migrateSqlite(db: Db): void {
  const cols = (table: string) =>
    (db.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>).map(
      (c) => c.name,
    );
  const ensureCol = (table: string, name: string, ddl: string) => {
    try {
      if (!cols(table).includes(name)) db.exec(`ALTER TABLE ${table} ADD COLUMN ${ddl}`);
    } catch {
      /* table may not exist yet */
    }
  };
  ensureCol("employee_profiles", "job_level", `job_level TEXT NOT NULL DEFAULT 'L2'`);
  ensureCol(
    "employee_profiles",
    "service_charge_eligible",
    `service_charge_eligible INTEGER NOT NULL DEFAULT 1`,
  );
  ensureCol(
    "payroll_periods",
    "service_charge_pool_minor",
    `service_charge_pool_minor INTEGER NOT NULL DEFAULT 0`,
  );
  ensureCol("users", "grants_version", `grants_version INTEGER NOT NULL DEFAULT 0`);
}

export function openDb(dbPath?: string): Db {
  const resolved = getDbPath(dbPath);
  fs.mkdirSync(path.dirname(resolved), { recursive: true });
  const db = new Database(resolved);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  db.exec(DDL);
  migrateSqlite(db);
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
