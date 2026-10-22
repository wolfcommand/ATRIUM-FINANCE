-- Phase 1 Trust core: grants_version + RLS on company-scoped tables (Cloud SQL / Postgres).
-- Forward-only. Local SQLite uses apps/api/src/db/schema.ts + migrateSqlite().

ALTER TABLE users ADD COLUMN IF NOT EXISTS grants_version INTEGER NOT NULL DEFAULT 0;

-- Company isolation helper: SET LOCAL app.company_ids = 'uuid1,uuid2' per request (architecture §4.4).

DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'employments',
    'app_entitlements',
    'finance_employee_ref',
    'employee_profiles',
    'payroll_policy_config',
    'payroll_periods',
    'access_requests'
  ]
  LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS company_isolation ON %I', t);
    EXECUTE format(
      'CREATE POLICY company_isolation ON %I
       USING (company_id::text = ANY (string_to_array(current_setting(''app.company_ids'', true), '','')))',
      t
    );
  END LOOP;
END $$;

-- HR tables added in greenfield (may exist after 001 expansion / later migrations)
DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'hr_departments',
    'hr_positions',
    'leave_types',
    'leave_balances',
    'leave_requests',
    'payroll_records',
    'payroll_items',
    'payslips'
  ]
  LOOP
    IF EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = t
    ) THEN
      EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
      EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', t);
      EXECUTE format('DROP POLICY IF EXISTS company_isolation ON %I', t);
      EXECUTE format(
        'CREATE POLICY company_isolation ON %I
         USING (company_id::text = ANY (string_to_array(current_setting(''app.company_ids'', true), '','')))',
        t
      );
    END IF;
  END LOOP;
END $$;
