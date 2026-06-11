import {
  boolean,
  integer,
  numeric,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from 'drizzle-orm/pg-core';

/**
 * Initial Drizzle schema — DESIGN.md M0 scope: team, account, source, snapshot.
 * The remaining tables (delta, trigger_event, feedback, dossier_version,
 * cost_ledger) land with the Postgres-backed pipeline in M2; their in-memory
 * shapes already exist in @tripwire/pipeline.
 */

export const team = pgTable('team', {
  id: text('id').primaryKey(),
  hubspotPortalId: text('hubspot_portal_id'),
  name: text('name').notNull(),
  plan: text('plan').notNull().default('trial'),
  icpProfileText: text('icp_profile_text').notNull().default(''),
  alertThreshold: numeric('alert_threshold', { precision: 4, scale: 3 }).notNull().default('0.6'),
  slackTeamId: text('slack_team_id'),
  peopleDataLicensed: boolean('people_data_licensed').notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const account = pgTable(
  'account',
  {
    id: text('id').primaryKey(),
    teamId: text('team_id')
      .notNull()
      .references(() => team.id),
    hubspotCompanyId: text('hubspot_company_id'),
    name: text('name').notNull(),
    /** Entity-resolution key (invariant 2); unique per team. */
    primaryDomain: text('primary_domain').notNull(),
    edgarCik: text('edgar_cik'),
    atsBoardToken: text('ats_board_token'),
    status: text('status', { enum: ['active', 'paused'] })
      .notNull()
      .default('active'),
    tier: integer('tier').notNull().default(2),
    monthlyBudgetUsd: numeric('monthly_budget_usd', { precision: 8, scale: 2 })
      .notNull()
      .default('0.50'),
  },
  (table) => [uniqueIndex('account_team_domain_uq').on(table.teamId, table.primaryDomain)],
);

export const source = pgTable('source', {
  id: text('id').primaryKey(),
  accountId: text('account_id')
    .notNull()
    .references(() => account.id),
  kind: text('kind', {
    enum: [
      'newsroom_rss',
      'sitemap',
      'edgar_8k',
      'ats_greenhouse',
      'ats_lever',
      'ats_ashby',
      'news_search',
    ],
  }).notNull(),
  urlOrQuery: text('url_or_query').notNull(),
  etag: text('etag'),
  lastFetchedAt: timestamp('last_fetched_at', { withTimezone: true }),
  consecutiveFailures: integer('consecutive_failures').notNull().default(0),
  enabled: boolean('enabled').notNull().default(true),
});

export const snapshot = pgTable('snapshot', {
  id: text('id').primaryKey(),
  sourceId: text('source_id')
    .notNull()
    .references(() => source.id),
  fetchedAt: timestamp('fetched_at', { withTimezone: true }).notNull(),
  /** SHA-256 of normalized sections — the diff firewall key (invariant 3). */
  contentHash: text('content_hash').notNull(),
  normalizedText: text('normalized_text').notNull(),
  httpStatus: integer('http_status').notNull(),
});
