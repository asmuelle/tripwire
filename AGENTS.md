# AGENTS.md — Operating manual for AI coding agents

## Project snapshot

**Tripwire** is a per-account buying-signal radar for SMB sales teams (3–20 reps, named-account
motion). A nightly pipeline maintains a living, versioned dossier per account inside HubSpot and
fires an alert only when a delta matches the team's ICP trigger profile — always with a pinned,
string-verified source quote and a suggested outreach angle. The **sales leader pays**
(account-metered: $99 Solo / $399 Team, $0.60/account overage). Pipeline status: **Tier 2** —
strong economics, but it must outrun HubSpot Breeze and Apollo bundling; the converted-trigger
feedback loop is the moat and gets built first.

## Read first

1. `README.md` — research dossier: market evidence, comparables, adversarial review. Treat its
   review section as binding constraints, not commentary.
2. `DESIGN.md` — architecture, data model, key flows, milestones (M0–M3), risk register.
3. `TOOLS.md` — every command, external API, env var, and CI behavior.

## Commands (single source of truth: `just`)

Always use `just` recipes, never raw pnpm/docker invocations. Recipes fail with guidance until
the workspace is bootstrapped (M0).

| Recipe                        | Purpose                                                 |
| ----------------------------- | ------------------------------------------------------- |
| `just`                        | List recipes                                            |
| `just setup`                  | corepack enable + pnpm install                          |
| `just dev`                    | Run the Next.js dev server                              |
| `just db-up` / `just db-down` | Start/stop local Postgres (pgvector) via docker compose |
| `just migrate`                | Apply Drizzle migrations                                |
| `just test`                   | Vitest unit tests                                       |
| `just e2e`                    | Playwright end-to-end tests                             |
| `just lint` / `just format`   | ESLint / Prettier                                       |
| `just typecheck`              | tsc --noEmit across the workspace                       |
| `just build`                  | Production build                                        |
| `just ci`                     | lint + typecheck + test + build (the merge gate)        |

## Architecture summary

A pnpm workspace where the "agent" is a deterministic nightly pipeline, not a framework: sources
are fetched and content-hash diffed in plain code, only deltas reach Haiku batch triage (ICP
profile prompt-cached), only above-threshold deltas reach Sonnet batch synthesis, and
deterministic gates (quote string-match, entity resolution, budget) stand between any model
output and the rep. Scheduling is **Inngest** (cron + fan-out + batch polling; see DESIGN.md).

| Module              | Responsibility                                                                                                                        |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| `apps/web`          | Next.js 15 App Router: HubSpot OAuth + CRM card, dashboard, Slack handlers, Inngest endpoint                                          |
| `packages/core`     | Pure TS domain logic: trigger taxonomy, quote verification, entity resolution, scoring, cost model. **No I/O, no framework imports.** |
| `packages/pipeline` | Fetchers, normalize/hash/diff, triage + synthesis workers, gates — as Inngest functions                                               |
| `packages/db`       | Drizzle schema, migrations, pgvector, seed fixtures                                                                                   |

## Coding standards

- TypeScript strict everywhere; no `any` without a written justification comment.
- Files < 800 lines, functions < 50 lines; split by feature, not by type.
- Immutability by default: return new objects, never mutate inputs.
- Explicit error handling at every boundary (fetchers, API routes, model calls, webhooks);
  never swallow errors — a failed fetch is a recorded `consecutive_failures` increment, not a log line lost.
- Validate all external data at the boundary (HubSpot payloads, feed XML/JSON, model output) with
  schema validation before it touches domain logic.
- No hardcoded secrets — env vars only, validated at startup (see TOOLS.md table).
- Conventional commits: `feat|fix|refactor|docs|test|chore`.

## Testing policy

- TDD: write the failing test first (RED → GREEN → refactor). Target 80%+ coverage; use the AAA
  pattern and behavior-describing test names.
- What matters most **for this product**, in order:
  1. **Gate tests** — quote verification and entity resolution are deterministic; test them
     exhaustively with adversarial fixtures (smart quotes, whitespace, truncation, wrong-company
     near-matches). A bug here ships a false alert and resets customer trust to zero.
  2. **Diff-engine tests** — unchanged content must provably produce zero LLM calls (assert via
     cost_ledger). Hash/normalize edge cases (reordered sections, tracking params, dates in
     footers) are where COGS leaks start.
  3. **Golden-account recall harness** (M2) — labeled real accounts with known triggers; recall
     and wrong-entity rate are regression-tested in CI.
  4. **Pipeline integration tests** — fixture sources through the full nightly run against the
     docker Postgres; model calls mocked with recorded batch responses.
  5. **E2E (Playwright)** — onboarding, dossier view, feedback buttons. Less critical than 1–4.

## PRODUCT INVARIANTS (non-negotiable; violating code does not merge)

1. **No alert without a verified quote.** Every delivered alert carries a pinned quote that
   exact-string-matches (after deterministic normalization) the stored snapshot text. The check
   is plain code — never an LLM judgment. `trigger_event.quote_verified_at` is NOT NULL before
   any delivery row exists; failures are `gate_blocked`, never delivered.
2. **Entity resolution is deterministic.** A delta attaches to an account only via a registered
   key: primary domain, EDGAR CIK, or ATS board token. Fuzzy company-name matching must never be
   able to fire an alert.
3. **Diff before LLM.** No model call on content whose normalized hash is unchanged. Tests must
   be able to prove a no-change run costs $0.00 in the llm cost_ledger category.
4. **Exec-change signals are off without a license.** Trigger profiles with
   `requires_people_data` stay disabled unless the team has a licensed people-data provider
   configured (`PEOPLE_DATA_API_KEY` + `team.people_data_licensed`). Never scrape LinkedIn or
   Indeed — ToS-locked sources are out, period, regardless of feature pressure.
5. **Every external call writes to cost_ledger.** LLM, search, scrape, people-data — no
   exceptions. Per-account budget gate halts spend at `account.monthly_budget_usd`. A PR adding
   an external call without ledger attribution is incomplete.
6. **The feedback loop is first-class.** Every alert surface renders Useful / Not useful /
   Converted; feedback writes are durable (retried, never fire-and-forget) and the table is
   append-only. This is the moat — it ships before any new signal type does.
7. **Dossiers are append-only and cited.** New `dossier_version` rows, never updates; every
   claim section references snapshot ids. Uncited synthesis output is rejected.
8. **Customer data stays scoped.** HubSpot/Slack tokens encrypted at rest; prompts and rerankers
   only ever see one team's data; cross-team aggregation requires explicit opt-in and
   anonymization (the M3+ benchmarking tier), enforced in query helpers, not by convention.
9. **Nightly pipeline uses batch only.** Triage and synthesis go through the Anthropic Batches
   API with prompt caching — no synchronous frontier calls in scheduled runs. Synchronous calls
   are reserved for user-facing interactive paths.
10. **Silence shows evidence.** Any surface listing a monitored account displays last-checked
    timestamps; a quiet account must be distinguishable from a broken one — by the rep and by tests.

## Definition of done

- [ ] Failing test written first; all tests green via `just test` (and `just e2e` if surfaces changed)
- [ ] `just ci` passes (lint + typecheck + test + build)
- [ ] No product invariant violated; gate/ledger tests added for any new external call or signal type
- [ ] Errors handled at every new boundary; external input schema-validated
- [ ] No secrets in code or fixtures; new env vars documented in TOOLS.md
- [ ] DESIGN.md updated if the data model, flows, or milestone scope changed
- [ ] Conventional commit message; files < 800 lines, functions < 50
