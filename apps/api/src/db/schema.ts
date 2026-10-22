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
  grants_version INTEGER NOT NULL DEFAULT 0,
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

-- Greenfield HRIS (Prompt 6/7) — company-scoped; PII on employee_profiles only
CREATE TABLE IF NOT EXISTS hr_departments (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL REFERENCES companies(id),
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  UNIQUE (company_id, code)
);

CREATE TABLE IF NOT EXISTS hr_positions (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL REFERENCES companies(id),
  department_id TEXT REFERENCES hr_departments(id),
  code TEXT NOT NULL,
  title TEXT NOT NULL,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  UNIQUE (company_id, code)
);

CREATE TABLE IF NOT EXISTS employee_id_sequences (
  company_id TEXT NOT NULL,
  yy_mm TEXT NOT NULL,
  last_seq INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (company_id, yy_mm)
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
  date_of_birth TEXT,
  gender TEXT,
  nik TEXT,
  npwp TEXT,
  address TEXT,
  emergency_contact_name TEXT,
  emergency_contact_phone TEXT,
  department_id TEXT REFERENCES hr_departments(id),
  position_id TEXT REFERENCES hr_positions(id),
  employment_type TEXT NOT NULL DEFAULT 'permanent',
  job_title TEXT,
  job_level TEXT NOT NULL DEFAULT 'L2',
  service_charge_eligible INTEGER NOT NULL DEFAULT 1,
  cost_centre TEXT,
  bank_name TEXT,
  bank_account_number TEXT,
  bank_account_name TEXT,
  base_salary_minor INTEGER NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'IDR',
  join_date TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('active','ended')) DEFAULT 'active',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  created_by TEXT,
  updated_by TEXT,
  UNIQUE (company_id, employee_code)
);

CREATE TABLE IF NOT EXISTS leave_types (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL REFERENCES companies(id),
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  default_entitlement REAL NOT NULL DEFAULT 0,
  requires_attachment INTEGER NOT NULL DEFAULT 0,
  requires_approval INTEGER NOT NULL DEFAULT 1,
  is_paid INTEGER NOT NULL DEFAULT 1,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  UNIQUE (company_id, code)
);

CREATE TABLE IF NOT EXISTS leave_balances (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL REFERENCES companies(id),
  employment_id TEXT NOT NULL REFERENCES employments(id),
  leave_type_id TEXT NOT NULL REFERENCES leave_types(id),
  year INTEGER NOT NULL,
  opening_balance REAL NOT NULL DEFAULT 0,
  earned REAL NOT NULL DEFAULT 0,
  used REAL NOT NULL DEFAULT 0,
  adjusted REAL NOT NULL DEFAULT 0,
  UNIQUE (employment_id, leave_type_id, year)
);

CREATE TABLE IF NOT EXISTS leave_requests (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL REFERENCES companies(id),
  employment_id TEXT NOT NULL REFERENCES employments(id),
  leave_type_id TEXT NOT NULL REFERENCES leave_types(id),
  start_date TEXT NOT NULL,
  end_date TEXT NOT NULL,
  total_days REAL NOT NULL,
  reason TEXT,
  status TEXT NOT NULL CHECK (status IN ('pending','approved','rejected','cancelled')) DEFAULT 'pending',
  submitted_at TEXT NOT NULL,
  decided_by TEXT,
  decided_at TEXT,
  rejection_reason TEXT
);

CREATE TABLE IF NOT EXISTS payroll_policy_config (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL REFERENCES companies(id),
  key TEXT NOT NULL,
  value_json TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  updated_by TEXT,
  UNIQUE (company_id, key)
);

CREATE TABLE IF NOT EXISTS payroll_periods (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL REFERENCES companies(id),
  period_code TEXT NOT NULL,
  start_date TEXT NOT NULL,
  end_date TEXT NOT NULL,
  pay_date TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('DRAFT','CALCULATED','UNDER_REVIEW','APPROVED','FINALIZED','LOCKED')) DEFAULT 'DRAFT',
  service_charge_pool_minor INTEGER NOT NULL DEFAULT 0,
  created_by TEXT,
  finalized_by TEXT,
  finalized_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE (company_id, period_code)
);

CREATE TABLE IF NOT EXISTS payroll_records (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL REFERENCES companies(id),
  payroll_period_id TEXT NOT NULL REFERENCES payroll_periods(id),
  employment_id TEXT NOT NULL REFERENCES employments(id),
  gross_pay_minor INTEGER NOT NULL DEFAULT 0,
  total_deductions_minor INTEGER NOT NULL DEFAULT 0,
  net_pay_minor INTEGER NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'IDR',
  status TEXT NOT NULL DEFAULT 'DRAFT',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE (payroll_period_id, employment_id)
);

CREATE TABLE IF NOT EXISTS payroll_items (
  id TEXT PRIMARY KEY,
  payroll_record_id TEXT NOT NULL REFERENCES payroll_records(id),
  component_code TEXT NOT NULL,
  component_name TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('earning','deduction')),
  amount_minor INTEGER NOT NULL,
  source_type TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS payslips (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL REFERENCES companies(id),
  payroll_record_id TEXT NOT NULL UNIQUE REFERENCES payroll_records(id),
  file_path TEXT,
  generated_at TEXT NOT NULL,
  published_at TEXT,
  email_status TEXT NOT NULL CHECK (email_status IN ('not_sent','queued','sent','failed')) DEFAULT 'not_sent',
  email_to TEXT,
  email_error TEXT,
  emailed_at TEXT
);

-- Phase 3 Academy (group catalog + company assignments + enrollments)
CREATE TABLE IF NOT EXISTS academy_courses (
  id TEXT PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  summary TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('draft','published','retired')) DEFAULT 'published',
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS academy_course_versions (
  id TEXT PRIMARY KEY,
  course_id TEXT NOT NULL REFERENCES academy_courses(id),
  version INTEGER NOT NULL,
  content_md TEXT NOT NULL,
  created_at TEXT NOT NULL,
  UNIQUE (course_id, version)
);

CREATE TABLE IF NOT EXISTS academy_assignments (
  id TEXT PRIMARY KEY,
  course_id TEXT NOT NULL REFERENCES academy_courses(id),
  target_type TEXT NOT NULL CHECK (target_type IN ('person','role','department','company')),
  target_id TEXT NOT NULL,
  due_days INTEGER,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS academy_enrollments (
  id TEXT PRIMARY KEY,
  course_id TEXT NOT NULL REFERENCES academy_courses(id),
  course_version_id TEXT NOT NULL REFERENCES academy_course_versions(id),
  user_id TEXT NOT NULL REFERENCES users(id),
  employment_id TEXT NOT NULL,
  company_id TEXT NOT NULL REFERENCES companies(id),
  status TEXT NOT NULL CHECK (status IN ('assigned','in_progress','completed')) DEFAULT 'assigned',
  assigned_at TEXT NOT NULL,
  due_at TEXT,
  completed_at TEXT,
  source_event_id TEXT,
  UNIQUE (course_id, employment_id)
);

CREATE TABLE IF NOT EXISTS academy_progress (
  id TEXT PRIMARY KEY,
  enrollment_id TEXT NOT NULL UNIQUE REFERENCES academy_enrollments(id),
  percent INTEGER NOT NULL DEFAULT 0 CHECK (percent >= 0 AND percent <= 100),
  last_position TEXT,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS academy_consumer_processed (
  idempotency_key TEXT NOT NULL,
  consumer TEXT NOT NULL,
  processed_at TEXT NOT NULL,
  PRIMARY KEY (idempotency_key, consumer)
);

-- Phase 4 core approvals (architecture §9.5)
CREATE TABLE IF NOT EXISTS approval_policies (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL REFERENCES companies(id),
  request_type TEXT NOT NULL,
  version INTEGER NOT NULL,
  valid_from TEXT NOT NULL,
  valid_to TEXT,
  created_at TEXT NOT NULL,
  UNIQUE (company_id, request_type, version)
);

CREATE TABLE IF NOT EXISTS approval_policy_steps (
  id TEXT PRIMARY KEY,
  policy_id TEXT NOT NULL REFERENCES approval_policies(id),
  step_no INTEGER NOT NULL,
  approver_rule TEXT NOT NULL,
  amount_threshold_minor INTEGER,
  UNIQUE (policy_id, step_no)
);

CREATE TABLE IF NOT EXISTS approval_requests (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL REFERENCES companies(id),
  request_type TEXT NOT NULL,
  subject_id TEXT NOT NULL,
  requester_user_id TEXT NOT NULL REFERENCES users(id),
  policy_id TEXT NOT NULL,
  policy_version INTEGER NOT NULL,
  chain_snapshot TEXT NOT NULL,
  amount_minor INTEGER,
  currency TEXT,
  status TEXT NOT NULL CHECK (status IN ('pending','approved','denied','cancelled')) DEFAULT 'pending',
  current_step INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  decided_at TEXT
);

CREATE TABLE IF NOT EXISTS approval_steps (
  id TEXT PRIMARY KEY,
  request_id TEXT NOT NULL REFERENCES approval_requests(id),
  step_no INTEGER NOT NULL,
  approver_user_id TEXT,
  status TEXT NOT NULL CHECK (status IN ('waiting','approved','denied','skipped')) DEFAULT 'waiting',
  decided_at TEXT,
  comment TEXT,
  UNIQUE (request_id, step_no)
);

CREATE TABLE IF NOT EXISTS expenses (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL REFERENCES companies(id),
  requester_user_id TEXT NOT NULL REFERENCES users(id),
  amount_minor INTEGER NOT NULL,
  currency TEXT NOT NULL,
  description TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('draft','submitted','approved','denied')) DEFAULT 'draft',
  approval_request_id TEXT,
  created_at TEXT NOT NULL
);

-- Phase 5 Content Machine (GGV-scoped)
CREATE TABLE IF NOT EXISTS content_campaigns (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL REFERENCES companies(id),
  name TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('draft','active','archived')) DEFAULT 'draft',
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS content_pieces (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL REFERENCES companies(id),
  campaign_id TEXT REFERENCES content_campaigns(id),
  title TEXT NOT NULL,
  channel TEXT NOT NULL,
  body_md TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('idea','draft','review','published','archived')) DEFAULT 'idea',
  created_by TEXT NOT NULL,
  updated_by TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  published_at TEXT
);
`
