/**
 * Logical schema for Wolf identity + org (architecture §4.2).
 * SQLite file DB for local/CI; Postgres is the production target (see DECISIONS).
 */

export const DDL = `
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('active','suspended','disabled')),
  password_hash TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS auth_identities (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  provider TEXT NOT NULL,
  subject TEXT NOT NULL,
  UNIQUE (provider, subject)
);

CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  created_at TEXT NOT NULL,
  last_seen_at TEXT NOT NULL,
  auth_level INTEGER NOT NULL DEFAULT 1,
  auth_time TEXT NOT NULL,
  device_info TEXT,
  revoked_at TEXT
);

CREATE TABLE IF NOT EXISTS companies (
  id TEXT PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  timezone TEXT NOT NULL,
  currency_default TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('active','inactive'))
);

CREATE TABLE IF NOT EXISTS employments (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  company_id TEXT NOT NULL REFERENCES companies(id),
  employee_no TEXT,
  status TEXT NOT NULL CHECK (status IN ('active','ended')),
  valid_from TEXT NOT NULL,
  valid_to TEXT
);

CREATE TABLE IF NOT EXISTS app_entitlements (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  company_id TEXT NOT NULL REFERENCES companies(id),
  app_key TEXT NOT NULL,
  UNIQUE (user_id, company_id, app_key)
);
`;
