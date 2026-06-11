-- M0 initial schema: team, account, source, snapshot (DESIGN.md data model).
-- pgvector is enabled now so the dossier_version.embedding column (M2) needs no
-- extension migration later.
CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS "team" (
  "id" text PRIMARY KEY,
  "hubspot_portal_id" text,
  "name" text NOT NULL,
  "plan" text NOT NULL DEFAULT 'trial',
  "icp_profile_text" text NOT NULL DEFAULT '',
  "alert_threshold" numeric(4,3) NOT NULL DEFAULT 0.6,
  "slack_team_id" text,
  "people_data_licensed" boolean NOT NULL DEFAULT false,
  "created_at" timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "account" (
  "id" text PRIMARY KEY,
  "team_id" text NOT NULL REFERENCES "team"("id"),
  "hubspot_company_id" text,
  "name" text NOT NULL,
  "primary_domain" text NOT NULL,
  "edgar_cik" text,
  "ats_board_token" text,
  "status" text NOT NULL DEFAULT 'active',
  "tier" integer NOT NULL DEFAULT 2,
  "monthly_budget_usd" numeric(8,2) NOT NULL DEFAULT 0.50,
  CONSTRAINT "account_status_check" CHECK ("status" IN ('active', 'paused'))
);

CREATE UNIQUE INDEX IF NOT EXISTS "account_team_domain_uq"
  ON "account" ("team_id", "primary_domain");

CREATE TABLE IF NOT EXISTS "source" (
  "id" text PRIMARY KEY,
  "account_id" text NOT NULL REFERENCES "account"("id"),
  "kind" text NOT NULL,
  "url_or_query" text NOT NULL,
  "etag" text,
  "last_fetched_at" timestamptz,
  "consecutive_failures" integer NOT NULL DEFAULT 0,
  "enabled" boolean NOT NULL DEFAULT true,
  CONSTRAINT "source_kind_check" CHECK (
    "kind" IN ('newsroom_rss', 'sitemap', 'edgar_8k', 'ats_greenhouse', 'ats_lever', 'ats_ashby', 'news_search')
  )
);

CREATE TABLE IF NOT EXISTS "snapshot" (
  "id" text PRIMARY KEY,
  "source_id" text NOT NULL REFERENCES "source"("id"),
  "fetched_at" timestamptz NOT NULL,
  "content_hash" text NOT NULL,
  "normalized_text" text NOT NULL,
  "http_status" integer NOT NULL
);
