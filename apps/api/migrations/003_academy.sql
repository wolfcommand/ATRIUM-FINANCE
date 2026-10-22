-- Phase 3 Academy tables (Postgres / Cloud SQL). Forward-only.

CREATE TABLE IF NOT EXISTS academy_courses (
  id TEXT PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  summary TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('draft','published','retired')) DEFAULT 'published',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS academy_course_versions (
  id TEXT PRIMARY KEY,
  course_id TEXT NOT NULL REFERENCES academy_courses(id),
  version INTEGER NOT NULL,
  content_md TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (course_id, version)
);

CREATE TABLE IF NOT EXISTS academy_assignments (
  id TEXT PRIMARY KEY,
  course_id TEXT NOT NULL REFERENCES academy_courses(id),
  target_type TEXT NOT NULL CHECK (target_type IN ('person','role','department','company')),
  target_id TEXT NOT NULL,
  due_days INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS academy_enrollments (
  id TEXT PRIMARY KEY,
  course_id TEXT NOT NULL REFERENCES academy_courses(id),
  course_version_id TEXT NOT NULL REFERENCES academy_course_versions(id),
  user_id TEXT NOT NULL REFERENCES users(id),
  employment_id TEXT NOT NULL,
  company_id TEXT NOT NULL REFERENCES companies(id),
  status TEXT NOT NULL CHECK (status IN ('assigned','in_progress','completed')) DEFAULT 'assigned',
  assigned_at TIMESTAMPTZ NOT NULL,
  due_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  source_event_id TEXT,
  UNIQUE (course_id, employment_id)
);

CREATE TABLE IF NOT EXISTS academy_progress (
  id TEXT PRIMARY KEY,
  enrollment_id TEXT NOT NULL UNIQUE REFERENCES academy_enrollments(id),
  percent INTEGER NOT NULL DEFAULT 0 CHECK (percent >= 0 AND percent <= 100),
  last_position TEXT,
  updated_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS academy_consumer_processed (
  idempotency_key TEXT NOT NULL,
  consumer TEXT NOT NULL,
  processed_at TIMESTAMPTZ NOT NULL,
  PRIMARY KEY (idempotency_key, consumer)
);

CREATE INDEX IF NOT EXISTS academy_enrollments_company_idx ON academy_enrollments (company_id);
CREATE INDEX IF NOT EXISTS academy_assignments_target_idx ON academy_assignments (target_type, target_id);

ALTER TABLE academy_enrollments ENABLE ROW LEVEL SECURITY;
ALTER TABLE academy_enrollments FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS company_isolation ON academy_enrollments;
CREATE POLICY company_isolation ON academy_enrollments
  USING (company_id::text = ANY (string_to_array(current_setting('app.company_ids', true), ',')));
