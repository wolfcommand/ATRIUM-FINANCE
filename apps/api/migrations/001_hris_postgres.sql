-- Wolf HRIS + platform tables — Postgres / Cloud SQL dialect
-- Local may still use SQLite DDL in apps/api/src/db/schema.ts (dev-only).
-- Apply with: psql "$DATABASE_URL" -f apps/api/migrations/001_hris_postgres.sql

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Identity / org (align with architecture §4.2)
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('active','suspended','disabled')),
  password_hash TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  auth_level INTEGER NOT NULL DEFAULT 1,
  auth_time TIMESTAMPTZ NOT NULL,
  device_info TEXT,
  revoked_at TIMESTAMPTZ
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
  valid_from DATE NOT NULL,
  valid_to DATE
);

CREATE TABLE IF NOT EXISTS app_entitlements (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  company_id TEXT NOT NULL REFERENCES companies(id),
  app_key TEXT NOT NULL,
  UNIQUE (user_id, company_id, app_key)
);

CREATE TABLE IF NOT EXISTS grants (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  role_id TEXT,
  permission_key TEXT,
  scope_type TEXT NOT NULL CHECK (scope_type IN ('group','company','department','self')),
  scope_id TEXT,
  valid_from TIMESTAMPTZ NOT NULL,
  valid_to TIMESTAMPTZ,
  granted_by TEXT,
  reason TEXT,
  ticket_ref TEXT
);

CREATE TABLE IF NOT EXISTS outbox_events (
  id TEXT PRIMARY KEY,
  aggregate_type TEXT NOT NULL,
  aggregate_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  event_version INTEGER NOT NULL DEFAULT 1,
  payload JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  published_at TIMESTAMPTZ,
  idempotency_key TEXT NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS finance_employee_ref (
  employment_id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL,
  display_name TEXT NOT NULL,
  cost_centre TEXT,
  status TEXT NOT NULL CHECK (status IN ('active','ended')),
  source_event_id TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS employee_profiles (
  id TEXT PRIMARY KEY,
  employment_id TEXT NOT NULL UNIQUE REFERENCES employments(id),
  company_id TEXT NOT NULL REFERENCES companies(id),
  employee_code TEXT NOT NULL,
  full_name TEXT NOT NULL,
  preferred_name TEXT,
  work_email TEXT,
  phone TEXT,
  date_of_birth DATE,
  gender TEXT,
  nik TEXT,
  npwp TEXT,
  address TEXT,
  emergency_contact_name TEXT,
  emergency_contact_phone TEXT,
  department_id TEXT,
  position_id TEXT,
  employment_type TEXT NOT NULL DEFAULT 'permanent',
  job_title TEXT,
  job_level TEXT NOT NULL DEFAULT 'L2',
  service_charge_eligible BOOLEAN NOT NULL DEFAULT TRUE,
  cost_centre TEXT,
  bank_name TEXT,
  bank_account_number TEXT,
  bank_account_name TEXT,
  base_salary_minor BIGINT NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'IDR',
  join_date DATE NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('active','ended')) DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by TEXT,
  updated_by TEXT,
  UNIQUE (company_id, employee_code)
);

CREATE TABLE IF NOT EXISTS payroll_policy_config (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL REFERENCES companies(id),
  key TEXT NOT NULL,
  value_json JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL,
  updated_by TEXT,
  UNIQUE (company_id, key)
);

CREATE TABLE IF NOT EXISTS payroll_periods (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL REFERENCES companies(id),
  period_code TEXT NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  pay_date DATE NOT NULL,
  status TEXT NOT NULL,
  service_charge_pool_minor BIGINT NOT NULL DEFAULT 0,
  created_by TEXT,
  finalized_by TEXT,
  finalized_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (company_id, period_code)
);

-- RLS stubs (enable when Cloud SQL roles are ready)
-- ALTER TABLE employee_profiles ENABLE ROW LEVEL SECURITY;
-- CREATE POLICY employee_profiles_company ON employee_profiles
--   USING (company_id = current_setting('app.company_id', true));
