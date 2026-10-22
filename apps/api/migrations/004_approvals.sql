-- Phase 4 core approvals + expenses (Postgres). Forward-only.

CREATE TABLE IF NOT EXISTS approval_policies (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL REFERENCES companies(id),
  request_type TEXT NOT NULL,
  version INTEGER NOT NULL,
  valid_from TIMESTAMPTZ NOT NULL,
  valid_to TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (company_id, request_type, version)
);

CREATE TABLE IF NOT EXISTS approval_policy_steps (
  id TEXT PRIMARY KEY,
  policy_id TEXT NOT NULL REFERENCES approval_policies(id),
  step_no INTEGER NOT NULL,
  approver_rule TEXT NOT NULL,
  amount_threshold_minor BIGINT,
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
  chain_snapshot JSONB NOT NULL,
  amount_minor BIGINT,
  currency TEXT,
  status TEXT NOT NULL CHECK (status IN ('pending','approved','denied','cancelled')) DEFAULT 'pending',
  current_step INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  decided_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS approval_steps (
  id TEXT PRIMARY KEY,
  request_id TEXT NOT NULL REFERENCES approval_requests(id),
  step_no INTEGER NOT NULL,
  approver_user_id TEXT,
  status TEXT NOT NULL CHECK (status IN ('waiting','approved','denied','skipped')) DEFAULT 'waiting',
  decided_at TIMESTAMPTZ,
  comment TEXT,
  UNIQUE (request_id, step_no)
);

CREATE TABLE IF NOT EXISTS expenses (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL REFERENCES companies(id),
  requester_user_id TEXT NOT NULL REFERENCES users(id),
  amount_minor BIGINT NOT NULL,
  currency TEXT NOT NULL,
  description TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('draft','submitted','approved','denied')) DEFAULT 'draft',
  approval_request_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS approval_requests_company_idx ON approval_requests (company_id);
CREATE INDEX IF NOT EXISTS expenses_company_idx ON expenses (company_id);

ALTER TABLE approval_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE approval_requests FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS company_isolation ON approval_requests;
CREATE POLICY company_isolation ON approval_requests
  USING (company_id::text = ANY (string_to_array(current_setting('app.company_ids', true), ',')));

ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE expenses FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS company_isolation ON expenses;
CREATE POLICY company_isolation ON expenses
  USING (company_id::text = ANY (string_to_array(current_setting('app.company_ids', true), ',')));
