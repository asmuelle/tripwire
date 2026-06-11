# Tripwire — Design Doc

> Per-account buying-signal radar, embedded in HubSpot. A nightly pipeline keeps a living,
> versioned dossier per named account and fires an alert only when a real trigger matches the
> team's ICP profile — always with a pinned, string-verified source quote and a suggested angle.

## Thesis

SMB sales teams already pay $59–149/seat for stale databases (Apollo) and shallow alerts (Sales
Navigator); nobody at that price maintains a cited, versioned dossier per named account inside the
CRM the rep already lives in. The defensible asset is not the signals — HubSpot Breeze, Clay, and
Apollo/Pocus can all ship signals — it is the converted-trigger feedback loop: per-team data on
which trigger types actually book meetings, logged against the CRM record. Therefore we build the
feedback loop and the trust gates first, and treat signal breadth as a cost-disciplined commodity.

## Scheduling decision

**Inngest** (not Temporal). Rationale: the "agent" is a nightly cron + fan-out pipeline, exactly
Inngest's shape — cron triggers, per-account step functions with automatic retries, `step.sleep`
for polling Anthropic Batches jobs (which can take hours), a local dev server, and zero
self-hosted infra at this stage. Temporal is the upgrade path if run volume or workflow
complexity outgrows Inngest; nothing in `packages/pipeline` may import Inngest types outside the
thin function-definition layer, so the swap stays cheap.

## Architecture

```
pnpm workspace
├── apps/web            Next.js 15 (App Router, TS strict)
│   ├── HubSpot app: OAuth callback, CRM account card (iframe), timeline events
│   ├── Dashboard: dossier viewer, trigger analytics, ICP profile editor, billing
│   ├── Slack: OAuth + interactive feedback handlers (useful / not useful / converted)
│   └── /api/inngest: serves pipeline functions to the Inngest runtime
├── packages/core       Pure TS domain logic — NO I/O, NO framework imports
│   ├── trigger taxonomy + ICP profile types
│   ├── quote verification (normalized exact string match)
│   ├── entity resolution (primary-domain / CIK / ATS-token keys)
│   ├── delta scoring, reranker weights, threshold logic
│   └── cost model (per-call USD attribution)
├── packages/pipeline   Ingestion / diff / triage / synthesis workers (Inngest functions)
│   ├── fetchers: RSS/sitemap raw HTTP, EDGAR 8-K RSS, Greenhouse/Lever/Ashby JSON,
│   │             Exa news search, Firecrawl fallback
│   ├── normalize → SHA-256 section hashing → diff (deterministic, pre-LLM)
│   ├── triage: Haiku batch + prompt-cached ICP profile
│   ├── synthesis: Sonnet batch → dossier version + alert draft
│   └── gates: quote verification, entity resolution, budget check (block, never warn)
└── packages/db         Drizzle ORM, Postgres + pgvector, migrations, seed fixtures
```

### Data flow (source → surface)

1. **Fetch** (deterministic): pull every enabled source for active accounts; honor ETag /
   Last-Modified; raw HTTP first, Firecrawl only on JS/bot-walled failures.
2. **Diff** (deterministic): normalize → hash sections → compare to last snapshot. Unchanged hash
   = pipeline ends here. Only deltas continue. This is the COGS firewall.
3. **Triage** (cheap model): Haiku 4.5 via Anthropic Batches API (50% discount), ICP trigger
   profile in a cached prompt prefix. Scores each delta against trigger types; below threshold →
   stored, not escalated.
4. **Synthesis** (frontier model): Sonnet batch updates the dossier section and drafts the alert
   (trigger, why-it-matters for this seller, suggested opening line, candidate pinned quote).
5. **Gates** (deterministic): pinned quote must exact-match the stored snapshot text; delta's
   source must belong to the account by primary-domain/CIK/ATS-token; account budget not
   exceeded. Any gate failure blocks the alert and logs the reason.
6. **Surface**: HubSpot CRM card + timeline event on the account record, Slack push with
   feedback buttons. Every alert click-path lands on cited evidence.
7. **Feedback**: rep verdicts write to the feedback table; a nightly job recomputes per-team
   trigger-type weights (simple reranker first — logistic over trigger_type × verdict counts).

### Cost discipline (who does what)

| Layer                              | Work                                                                                             | Cost target        |
| ---------------------------------- | ------------------------------------------------------------------------------------------------ | ------------------ |
| Deterministic code                 | fetch, normalize, hash, diff, quote gate, entity gate, cost ledger, digests                      | ~$0                |
| Cheap model (Haiku, batch + cache) | delta triage vs ICP profile                                                                      | ≤ $0.02/account/mo |
| Frontier model (Sonnet, batch)     | dossier synthesis + alert composition, only above threshold                                      | ≤ $0.06/account/mo |
| Search API (Exa)                   | news/funding discovery, ≤1 query/account/night, skipped for quiet accounts on a backoff schedule | ≤ $0.25/account/mo |
| Scraping fallback (Firecrawl)      | only after raw HTTP fails twice                                                                  | ≤ $0.10/account/mo |

The adversarial review showed real blended COGS is $0.30–1.00/account/mo at full breadth, not the
pitched $0.10–0.30. We hold ≤ $0.50 by capping search queries, backoff on silent sources, and
gating exec-change/tech-stack signals behind licensed data that a customer's plan explicitly pays
for. The cost_ledger makes this auditable per account per day — not a quarterly surprise.

## Data model sketch

- **team** — id, hubspot_portal_id, plan, icp_profile_text, alert_threshold, slack_team_id,
  people_data_licensed (bool, default false), created_at
- **account** — id, team_id, hubspot_company_id, name, **primary_domain** (entity-resolution
  key, unique per team), edgar_cik (nullable), ats_board_token (nullable), status
  (active/paused), tier, monthly_budget_usd
- **source** — id, account_id, kind (newsroom_rss | sitemap | edgar_8k | ats_greenhouse |
  ats_lever | ats_ashby | news_search), url_or_query, etag, last_fetched_at,
  consecutive_failures, enabled
- **snapshot** — id, source_id, fetched_at, content_hash (SHA-256 of normalized sections),
  normalized_text, http_status
- **delta** — id, source_id, prev_snapshot_id, curr_snapshot_id, diff_text, detected_at,
  triage_score, matched_profile_id (nullable), status (pending | below_threshold | promoted |
  gate_blocked)
- **trigger_profile** — id, team_id, name ("hiring first RevOps lead", "raised Series B"),
  description, examples, weight (reranker-owned), requires_people_data (bool), enabled
- **trigger_event** — id, account_id, delta_id, trigger_profile_id, score, pinned_quote,
  quote_verified_at (NOT NULL before any delivery), source_url, source_fetched_at,
  suggested_angle; child alert_delivery rows: channel (hubspot_card | hubspot_timeline | slack),
  delivered_at, delivery_status
- **feedback** — id, trigger_event_id, user_id, verdict (useful | not_useful | converted),
  meeting_booked_at (nullable), created_at — **the moat table; append-only, never deleted**
- **dossier_version** — id, account_id, version_no, body_md, embedding (pgvector), citations
  (array of snapshot ids; every claim section must reference one), created_at — append-only
- **cost_ledger** — id, account_id, run_date, category (llm | search | scrape | people_data),
  units, usd_cost — written by every external call, no exceptions

## Key flows

### 1. Nightly monitoring run

1. Inngest cron (02:00 team-local) fans out one run per active account.
2. Fetch all enabled sources; record snapshots; ETag hits and unchanged hashes end the branch.
3. Deltas batched to Haiku triage (one Batches job per team, ICP profile prompt-cached);
   `step.sleep` polls completion.
4. Promoted deltas batched to Sonnet synthesis → dossier section update + alert draft.
5. Gates run in deterministic code: quote string-match, entity key check, budget check.
6. Passing alerts write trigger_event + alert_delivery, post the HubSpot timeline event and CRM
   card update, push to Slack. dossier_version appended. cost_ledger rows written at every step.

### 2. Onboarding (day-one value)

1. Sales leader installs the HubSpot app from the marketplace; OAuth grants company-read +
   timeline-write scopes (tokens encrypted at rest).
2. Tripwire imports named accounts (company name + domain) and resolves each to a primary
   domain; ambiguous domains are queued for one-click human confirmation, never guessed.
3. Source discovery per account: probe `/{blog,news,press}` + sitemap for RSS, match EDGAR CIK by
   name+domain (public cos only), probe Greenhouse/Lever/Ashby board tokens.
4. First run executes immediately for the top 25 accounts so the trial shows populated dossiers
   on the CRM record within the hour; the rest fill in overnight.
5. Leader picks 3–5 trigger profiles from the taxonomy and writes the ICP in one textarea.

### 3. Alert → feedback → reranker (the moat loop)

1. Rep sees Slack alert: trigger label, pinned quote with source link + timestamp, why-it-matters,
   suggested opening line, and three buttons: Useful / Not useful / Converted.
2. Verdict writes a feedback row; "Converted" also prompts for the meeting date and logs an
   outcome note to the HubSpot account timeline (attribution lives in the CRM — lock-in).
3. Nightly reranker recomputes per-team trigger_profile weights from feedback counts; weights
   shift triage thresholds (noisy types need higher scores to fire; converting types fire easier).
4. Trigger analytics dashboard shows trigger-type → meeting conversion per team — the report a
   sales leader screenshots into their Monday meeting, and the dataset no horizontal agent has.

### 4. Trust gate (why reps believe an alert)

1. Synthesis must return the pinned quote as an exact span; code normalizes whitespace/quotes on
   both sides and requires a substring match against the stored snapshot text.
2. On mismatch: one retry with a "quote verbatim" repair prompt; second failure → delta marked
   gate_blocked, surfaced in an internal review queue, never to the rep.
3. Entity gate: the delta's source must be registered to the account (domain/CIK/token match
   recorded at source creation). No fuzzy company-name matching can fire an alert.
4. Every dossier claim renders with its citation chip; clicking shows the snapshot excerpt and
   fetch timestamp.

### 5. Silent-account proof (anti-churn)

1. Most private SMB accounts emit no signal for months; silence must look like vigilance, not a
   dead product.
2. Weekly digest per rep: "Monitored 87 accounts, 412 fetches, 9 deltas triaged, 2 alerts" with
   per-account last-checked timestamps on the CRM card.
3. Quiet months surface the dossier's "what we're watching" section (open trigger profiles per
   account) so the subscription's standing value is visible without manufacturing noise.

## Product & visual design direction

**Wire-brief editorial** — the product is an intelligence briefing, so it should look like one.
Paper-warm background (oklch 97% 0.01 90), ink text (oklch 20% 0.01 60), one signal-red accent
(oklch 55% 0.19 28) reserved exclusively for fired triggers — red appears nowhere else, so a red
element always means "act". Typography: Source Serif 4 for dossier headlines and pull-quotes,
IBM Plex Sans for UI, IBM Plex Mono for timestamps, source slugs, and hashes — evidence is
visually monospaced everywhere it appears. Pinned quotes render as wire-service excerpts with a
hairline left rule, mono source-line (`8-K · sec.gov · fetched 02:14 UTC`), and dense
column-width measure; no cards-with-drop-shadows, hierarchy comes from rules, weight, and scale.
The HubSpot CRM card keeps the same evidence styling (mono citations, red trigger chips) inside
HubSpot's neutral chrome so it reads as native but unmistakably Tripwire.

## Milestones

### M0 — Bootstrap (make `just ci` green)

Scaffold the pnpm workspace per the module map: root `package.json` with scripts `dev`, `test`,
`e2e`, `lint`, `format`, `typecheck`, `build`, `migrate`; TS strict everywhere; `docker-compose.yml`
with `pgvector/pgvector:pg16`; initial Drizzle schema (team, account, source, snapshot) +
migration; one real unit test in `packages/core` (hash-diff of two fixture pages).
**Accept when:** `just db-up && just migrate` works locally; `just ci` passes locally and in
GitHub Actions (bootstrapped path, Postgres service container).

### M1 — Thin vertical slice

One team, 10 seeded accounts (fixtures, no HubSpot yet), two source kinds: newsroom RSS +
Greenhouse ATS feed. Nightly Inngest cron runs fetch → hash-diff → Haiku batch triage → Sonnet
synthesis → quote gate → Slack alert; dossier viewer page in apps/web; cost_ledger written end to
end. **Accept when:** (a) mutating a fixture newsroom page produces exactly one Slack alert with
a string-verified pinned quote; (b) a run over unchanged fixtures produces **zero** LLM calls,
proven by an empty cost_ledger llm category; (c) a deliberately mis-quoted synthesis fixture is
gate_blocked and never delivered; all three as automated tests.

### M2 — Trust layer

Entity-resolution gate live; HubSpot public app (OAuth, account import, CRM card with dossier +
last-checked, timeline events); feedback buttons writing to the feedback table; silent-account
weekly digest; golden-account recall harness (≥20 real accounts with hand-labeled known triggers,
recall and wrong-entity rate reported per run in CI). **Accept when:** wrong-entity rate on the
golden set is 0; quote-verification coverage is 100% of delivered alerts; a HubSpot sandbox
portal shows a populated card within 1 hour of install.

### M3 — Monetization wiring

Account-metered Stripe billing per the dossier recommendation: Solo $99/mo (150 accounts), Team
$399/mo (5 seats, 750 accounts), $0.60/account overage, 20% annual prepay; 14-day trial seeded
from the customer's CRM; trigger-to-meeting analytics dashboard; per-account COGS report from
cost_ledger beside revenue. HubSpot Marketplace listing submitted. **Accept when:** a trial
converts to a paid plan end to end in Stripe test mode; metered overage invoices correctly at
account 151; the margin report shows blended COGS ≤ $0.50/account/mo on the golden set.

## Risks & mitigations (from the adversarial review)

| #   | Risk                                                                                                                      | Mitigation                                                                                                                                                                                                                                                            |
| --- | ------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | **HubSpot Breeze sherlocks the app** — the landlord ships signals natively on the same surface.                           | Build the converted-trigger feedback loop (M1–M2) before signal breadth; the per-team trigger→meeting dataset and CRM-logged attribution are what Breeze doesn't have. Keep Slack as a second surface so the product survives marketplace squeeze.                    |
| 2   | **Exec-change signals are inaccessible** — they live on LinkedIn; press releases catch a fraction.                        | Drop exec-change from the pitch and the default taxonomy. `requires_people_data` flag keeps those trigger profiles disabled unless a licensed provider (Live Data Technologies–class) is configured and priced into the plan. Never scrape LinkedIn/Indeed.           |
| 3   | **COGS blowout** — real blended cost is $0.30–1.00/account/mo, not $0.10–0.30; the team plan can be underwater.           | Diff-before-LLM firewall; ≤1 search query/account/night with backoff on silent accounts; cost_ledger on every external call; per-account budget gate halts spend at the cap; pricing already set to the dossier's corrected model ($399/750 accounts, $0.60 overage). |
| 4   | **Trust resets to zero** — one wrong-company ping or one missed funding round on a tier-1 account kills the subscription. | Deterministic entity gate (domain/CIK/token primary keys, no fuzzy matching); deterministic quote gate before delivery; golden-account recall harness in CI so misses are measured, not discovered by churned customers.                                              |
| 5   | **Silent accounts feel dead → churn; lowered thresholds → noise → muted Slack channel.**                                  | Per-team reranked thresholds instead of a global knob; weekly monitoring-proof digest with last-checked evidence; "what we're watching" standing section so quiet months still show work.                                                                             |
| 6   | **Salesmotion already occupies the sub-$100 wedge** — Tripwire is a fast follower.                                        | Differentiate on the two things Salesmotion doesn't market: CRM-record embedding with timeline attribution, and trigger-conversion analytics. Win the HubSpot Marketplace install motion (lowest-CAC channel) rather than the open web.                               |
