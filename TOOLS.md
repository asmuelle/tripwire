# TOOLS.md — Commands, APIs, env vars, CI

## just recipes

| Recipe           | What it does                                                        | When to run                                     |
| ---------------- | ------------------------------------------------------------------- | ----------------------------------------------- |
| `just`           | Lists all recipes                                                   | Orientation                                     |
| `just setup`     | `corepack enable` + `pnpm install`                                  | After clone, after lockfile changes             |
| `just dev`       | Next.js dev server (+ Inngest dev server via the root `dev` script) | Daily development                               |
| `just db-up`     | `docker compose up -d postgres` (pgvector/pgvector:pg16)            | Before migrate/test/dev                         |
| `just db-down`   | Stops the local Postgres container                                  | Cleanup                                         |
| `just migrate`   | Applies Drizzle migrations to `DATABASE_URL`                        | After schema changes, after pull                |
| `just test`      | Vitest unit tests across the workspace                              | Constantly (TDD)                                |
| `just e2e`       | Playwright end-to-end suite                                         | Before merging surface changes                  |
| `just lint`      | ESLint across packages                                              | Before commit                                   |
| `just format`    | Prettier write                                                      | Before commit (also auto-runs on edit via hook) |
| `just typecheck` | `tsc --noEmit` across packages                                      | Before commit                                   |
| `just build`     | Production build of all packages                                    | Before merging                                  |
| `just ci`        | lint + typecheck + test + build                                     | The merge gate; CI runs exactly this            |

All recipes that need the workspace fail with a pointer to DESIGN.md M0 until `package.json`
exists (docs-only scaffold stays usable).

## External data sources & APIs

| Source                                   | Endpoint / feed                                                                                                                               | Auth env var                                                                                           | Cost & limits                                                                                                                                                     |
| ---------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| SEC EDGAR 8-K RSS + full-text            | `https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK={cik}&type=8-K&output=atom`, `https://efts.sec.gov/LATEST/search-index?q=...` | none (`SEC_EDGAR_USER_AGENT` required — SEC fair-access rules demand a declared UA with contact email) | Free; ≤10 req/s; public companies only — most SMB named accounts are private, treat as bonus coverage                                                             |
| Greenhouse job board                     | `https://boards-api.greenhouse.io/v1/boards/{token}/jobs?content=true`                                                                        | none                                                                                                   | Free, public JSON; discover `{token}` at onboarding                                                                                                               |
| Lever postings                           | `https://api.lever.co/v0/postings/{site}?mode=json`                                                                                           | none                                                                                                   | Free, public JSON                                                                                                                                                 |
| Ashby job board                          | `https://api.ashbyhq.com/posting-api/job-board/{name}`                                                                                        | none                                                                                                   | Free, public JSON                                                                                                                                                 |
| Company newsrooms / blogs                | RSS, Atom, sitemaps via raw HTTP (ETag/Last-Modified honored)                                                                                 | none                                                                                                   | Free; content-hash diff is the cost firewall                                                                                                                      |
| Exa search (news/funding)                | `https://api.exa.ai/search`                                                                                                                   | `EXA_API_KEY`                                                                                          | ~$2.5–8/1k queries — the **dominant COGS line**; hard cap ≤1 query/account/night with backoff (see DESIGN.md cost table)                                          |
| Firecrawl (scrape fallback)              | `https://api.firecrawl.dev/v1/scrape`                                                                                                         | `FIRECRAWL_API_KEY`                                                                                    | Credit-metered; only invoked after raw HTTP fails twice on a source                                                                                               |
| Anthropic Batches API                    | `https://api.anthropic.com/v1/messages/batches` (Haiku triage, Sonnet synthesis)                                                              | `ANTHROPIC_API_KEY`                                                                                    | 50% batch discount + prompt caching on the ICP profile; nightly pipeline is batch-only (invariant 9)                                                              |
| HubSpot app (OAuth, CRM cards, timeline) | `https://api.hubapi.com`                                                                                                                      | `HUBSPOT_CLIENT_ID`, `HUBSPOT_CLIENT_SECRET`                                                           | Free API; per-portal rate limits (~110 req/10s); tokens encrypted at rest                                                                                         |
| Slack app (alerts + feedback buttons)    | `https://slack.com/api/chat.postMessage`, interactivity webhook                                                                               | `SLACK_BOT_TOKEN`, `SLACK_SIGNING_SECRET`                                                              | Free; ~1 msg/s per channel                                                                                                                                        |
| People-data (exec changes) — OPTIONAL    | Live Data Technologies–class provider, decided at M3+                                                                                         | `PEOPLE_DATA_API_KEY`                                                                                  | $0.10–0.50/account/mo licensed. **Without this key, exec-change trigger profiles stay disabled (invariant 4). LinkedIn/Indeed scraping is never an alternative.** |

## Required env vars

| Var                                           | Purpose                                                     |
| --------------------------------------------- | ----------------------------------------------------------- |
| `DATABASE_URL`                                | Postgres + pgvector connection string                       |
| `ANTHROPIC_API_KEY`                           | Batch triage (Haiku) + synthesis (Sonnet)                   |
| `EXA_API_KEY`                                 | News/funding search                                         |
| `FIRECRAWL_API_KEY`                           | JS/bot-walled page fallback                                 |
| `SEC_EDGAR_USER_AGENT`                        | Declared UA string with contact email for EDGAR fair access |
| `HUBSPOT_CLIENT_ID` / `HUBSPOT_CLIENT_SECRET` | HubSpot public app OAuth                                    |
| `SLACK_BOT_TOKEN` / `SLACK_SIGNING_SECRET`    | Slack alerts + interactive feedback                         |
| `INNGEST_EVENT_KEY` / `INNGEST_SIGNING_KEY`   | Inngest scheduling (production)                             |
| `TOKEN_ENCRYPTION_KEY`                        | Encrypts stored HubSpot/Slack OAuth tokens at rest          |
| `STRIPE_SECRET_KEY` / `STRIPE_WEBHOOK_SECRET` | Metered billing (M3)                                        |
| `PEOPLE_DATA_API_KEY`                         | Optional; unlocks exec-change trigger profiles only         |

Never commit values; validate presence at startup and fail fast with the missing name.

## Local services

- **Postgres 16 + pgvector**: `just db-up` runs `pgvector/pgvector:pg16` via docker compose on
  `localhost:5432`. Used by migrations, unit/integration tests, and dev.
- **Inngest dev server**: bundled into the root `dev` script once bootstrapped; serves
  `apps/web/api/inngest` locally so nightly functions can be triggered on demand.

## CI (.github/workflows/ci.yml)

- Triggers on every push and pull_request; single job on `ubuntu-latest`.
- Steps: checkout → `extractions/setup-just@v3` → Node 22 + corepack → **bootstrap guard** →
  `pnpm install --frozen-lockfile` → `just ci`.
- **Bootstrap guard:** if `package.json` is absent (docs-only scaffold), install and `just ci`
  are skipped with a notice and the run stays green. Once M0 lands, the full gate runs.
- A `pgvector/pgvector:pg16` service container is wired via `DATABASE_URL` for integration
  tests; it is only consumed on the bootstrapped path.

## AI harness notes (.claude/settings.json)

- **PostToolUse hooks**: Prettier auto-formats edited `.ts/.tsx/.js/.jsx/.json/.css/.md`; ESLint
  `--fix` runs on edited `.ts/.tsx`. Both no-op until `package.json` exists.
- **Stop hook**: `tsc --noEmit` runs when a session ends — type errors surface before you leave.
- Pre-approved commands: `just`, `pnpm`, `node`, `npx vitest`, `npx playwright`,
  `docker compose`, read-only git.
- Most useful subagents here:
  - **tdd-guide** — start every gate/diff-engine feature test-first (AGENTS.md testing order).
  - **code-reviewer** — after any change touching `packages/core` gates or the pipeline.
  - **security-reviewer** — mandatory for HubSpot/Slack OAuth, token storage, webhook
    verification, and anything reading customer CRM data (invariant 8).
  - **planner** — before milestone-sized work; keep DESIGN.md milestones in sync.
