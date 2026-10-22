-- Phase 5 Content Machine (GGV-scoped). Forward-only.

CREATE TABLE IF NOT EXISTS content_campaigns (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL REFERENCES companies(id),
  name TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('draft','active','archived')) DEFAULT 'draft',
  created_by TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
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
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  published_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS content_campaigns_company_idx ON content_campaigns (company_id);
CREATE INDEX IF NOT EXISTS content_pieces_company_idx ON content_pieces (company_id);

ALTER TABLE content_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE content_campaigns FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS company_isolation ON content_campaigns;
CREATE POLICY company_isolation ON content_campaigns
  USING (company_id::text = ANY (string_to_array(current_setting('app.company_ids', true), ',')));

ALTER TABLE content_pieces ENABLE ROW LEVEL SECURITY;
ALTER TABLE content_pieces FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS company_isolation ON content_pieces;
CREATE POLICY company_isolation ON content_pieces
  USING (company_id::text = ANY (string_to_array(current_setting('app.company_ids', true), ',')));
