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

CREATE TABLE IF NOT EXISTS permissions (
  key TEXT PRIMARY KEY,
  description TEXT NOT NULL,
  default_classification INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS roles (
  id TEXT PRIMARY KEY,
  company_id TEXT,
  name TEXT NOT NULL,
  is_system INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS role_permissions (
  role_id TEXT NOT NULL REFERENCES roles(id),
  permission_key TEXT NOT NULL REFERENCES permissions(key),
  PRIMARY KEY (role_id, permission_key)
);

CREATE TABLE IF NOT EXISTS grants (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  role_id TEXT REFERENCES roles(id),
  permission_key TEXT,
  scope_type TEXT NOT NULL CHECK (scope_type IN ('group','company','department','self')),
  scope_id TEXT,
  valid_from TEXT NOT NULL,
  valid_to TEXT,
  granted_by TEXT,
  reason TEXT,
  ticket_ref TEXT
);

-- Prompt 7: transactional outbox + finance read model (no HR publishers yet)
CREATE TABLE IF NOT EXISTS outbox_events (
  id TEXT PRIMARY KEY,
  aggregate_type TEXT NOT NULL,
  aggregate_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  event_version INTEGER NOT NULL DEFAULT 1,
  payload TEXT NOT NULL,
  created_at TEXT NOT NULL,
  published_at TEXT,
  idempotency_key TEXT NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS dead_letter_events (
  id TEXT PRIMARY KEY,
  outbox_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  event_version INTEGER NOT NULL,
  payload TEXT NOT NULL,
  error_message TEXT NOT NULL,
  failed_at TEXT NOT NULL,
  consumer TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS finance_employee_ref (
  employment_id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL,
  display_name TEXT NOT NULL,
  cost_centre TEXT,
  status TEXT NOT NULL CHECK (status IN ('active','ended')),
  source_event_id TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS finance_consumer_processed (
  idempotency_key TEXT PRIMARY KEY,
  consumer TEXT NOT NULL,
  processed_at TEXT NOT NULL
);

-- Prompt 8: admin audit + access requests
CREATE TABLE IF NOT EXISTS audit_events (
  id TEXT PRIMARY KEY,
  occurred_at TEXT NOT NULL,
  actor_user_id TEXT,
  action TEXT NOT NULL,
  resource_type TEXT NOT NULL,
  resource_id TEXT,
  company_id TEXT,
  outcome TEXT NOT NULL,
  changes TEXT
);

CREATE TABLE IF NOT EXISTS access_requests (
  id TEXT PRIMARY KEY,
  requester_user_id TEXT NOT NULL REFERENCES users(id),
  company_id TEXT NOT NULL REFERENCES companies(id),
  permission_key TEXT NOT NULL,
  reason TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pending','approved','denied')),
  created_at TEXT NOT NULL,
  decided_at TEXT,
  decided_by TEXT
);
`
