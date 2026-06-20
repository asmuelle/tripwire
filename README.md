# Tripwire

> Per-account buying-signal radar for SMB sales teams: a nightly agent maintains a living dossier on every named account inside the CRM and pings the rep only when a real trigger fires — with the pinned source quote and a suggested outreach angle.

**Category:** LLM wiki / auto-research (living documents + delta alerts, à la Karpathy)

## Concept

Per-account buying-signal radar for SMB sales teams: a nightly agent maintains a living dossier on every named account inside the CRM and pings the rep only when a real trigger fires — with the pinned source quote and a suggested outreach angle.

## Target User

Sales teams of 3-20 reps at B2B SMBs running named-account motions, plus founders doing founder-led sales. The sales leader pays: reps burn 1-3 hours of research per account, signal-based selling is an established motion with quantifiable ROI, and one extra meeting booked pays for a month.

## Auto-Research Mechanic (the living document + delta engine)

Per-account standing agents over company newsrooms/RSS, SEC filings (8-K/10-K), public job boards (roles that signal need for your product), exec-change announcements, funding events, tech-stack change detection, and news via search APIs. Nightly batch (latency irrelevant; batch discount plus cache reads hold COGS at ~$0.10-0.30/account/month). Cheap-model triage scores deltas against the team's ICP trigger profile ('hiring first RevOps lead', 'raised Series B', 'CFO changed'); frontier synthesis updates the living dossier and — only above threshold — fires a Slack/CRM alert with the trigger, pinned quote + URL + timestamp, why it matters for this seller, and a suggested opening line. Reps mark triggers useful/converted, feeding a per-team relevance model.

## Product Surface

CRM-embedded first (HubSpot and Salesforce apps — the dossier lives on the account record) + Slack alerts for daily push. CRM embedding makes Tripwire invisible infrastructure in the rep's existing ritual and is the surface ChatGPT structurally cannot occupy.

## Why Now (2026 timing)

Clay's 263% YoY growth to $100M ARR versus ZoomInfo's +2% proves the AI-native repricing playbook in the adjacent category — but Clay is enrichment-and-workflow-centric, not a living-dossier monitor, and prices above SMB. No credible sub-$100/seat signal product exists. Batch + cache economics only made per-account always-on monitoring viable in 2026.

## Proposed Monetization

Usage-based, transparent metering flat competitors can't match: $99/mo per seat including 100 tracked accounts, then $0.75/account/month; $499/mo team plan (5 seats, 1,000 accounts, CRM sync, trigger analytics). Deliberately below Clay's $185-600/mo tier with predictable per-account COGS.

## Competition & Gap

Clay (enrichment campaigns, not continuous account dossiers), UserGems (job-change tracking only, enterprise pricing), Apollo/ZoomInfo (static databases going stale — ZoomInfo's 2.5x multiple tells the story), LinkedIn Sales Navigator alerts (shallow, unsourced). Nobody maintains a versioned account dossier with cited triggers at SMB price.

## Claimed Moat

(1) The converted-trigger feedback loop is proprietary signal-to-revenue data — which trigger types book meetings per ICP — compounding per team and industry; no horizontal agent has it. (2) CRM workflow embedding (alerts logged to the account record, outreach tracked against triggers) creates operational lock-in. (3) Cross-run per-entity memory is the product; ChatGPT scheduled tasks and Gemini's single-turn API structurally lack it. (4) Pinned source quotes rebuild rep trust that hallucination-prone generic 'AI account research' has already burned.

---

## Comparables

- Clay — $100M ARR (Nov 2025), $3.1B valuation (Apr 2026 Series C), 10,000+ customers; tiers ~$149-800/mo; enrichment/workflow-centric, not continuous monitoring
- Apollo.io — $150M ARR (May 2025); $59-149/user/mo; acquired Pocus (Mar 2026) to add signal-based selling — primary bundling threat
- ZoomInfo — ~$1.21B FY2024 revenue, declining 1-2% YoY; static database being repriced; validates the displacement thesis
- UserGems — $2,750-$10,000/mo ($33K-$120K/yr); job-change + 21 signal types; enterprise-only, leaves SMB gap
- Salesmotion — $85/mo (individual, 100 accounts) / $349/mo (team, 5 users, 500 accounts); signal + research + outreach agents; closest direct competitor, already occupies the claimed wedge
- Champify — $2,000-6,000+/mo; relationship/job-change signals, enterprise-leaning
- Common Room — ~$625/mo Standard with free tier; community/intent signal aggregation
- Koala — shut down Sept 2025 (team acqui-hired by Cursor); cautionary comp for category consolidation
- Pocus — custom mid-five-figure annual pricing; acquired by Apollo Mar 2026
- LinkedIn Sales Navigator — ~$99-180/seat/mo; shallow unsourced alerts; the inferior alternative many SMB reps already pay for

## Adversarial Review

Tripwire's moat analysis is aimed at the wrong attacker. It correctly argues ChatGPT/Perplexity can't occupy the CRM account record — but the CRM landlords already do. HubSpot Breeze Intelligence ships Clearbit-powered enrichment + buyer-intent natively on the exact surface Tripwire claims, with zero-setup access to every interaction; Salesforce Agentforce has 18,500 customers. A HubSpot app whose entire value is 'better signals on the account record' is a Sherlock target, and HubSpot controls the API, the app store, and the pricing. Two founding claims are verifiably false: (a) 'no credible sub-$100/seat signal product exists' — Apollo Professional at $79/seat already bundles buying intent and job-change alerts WITH data and sequencing; (b) 'Clay is enrichment-centric, not a living-dossier monitor' — Clay shipped Custom Signals (funding, career movement, tech stack, account-level intent, social monitoring added early 2026) and is at $100M ARR with the distribution to move down-market faster than Tripwire can move up. DATA ACCESS kills the headline signals: the highest-value trigger ('CFO changed') lives on LinkedIn, which is legally and technically locked — that's precisely why UserGems charges enterprise prices; press releases catch a fraction of exec changes. SEC 8-K/10-K filings are free but irrelevant: SMB named accounts are overwhelmingly private companies. The $0.10-0.30/account/month COGS models only LLM tokens (which are indeed cheap in batch) and ignores the dominant costs: search API at ~$2.5-8/1k queries means 1-3 nightly queries/account is $0.08-0.70/account/mo alone; render-capable scraping behind Cloudflare pay-per-crawl adds $0.05-0.30; licensed people-data for exec tracking adds $0.10-0.50; tech-stack vendors (BuiltWith/HG) have four-figure monthly minimums. Realistic blended COGS at the promised breadth is $0.30-1.00/account/mo — so the $499 team plan (1,000 accounts = $0.50/account revenue) is at or below water, and the per-seat plan runs 0-70% gross margin, not SaaS margin. TRUST: the asymmetry is brutal — private SMB accounts emit sparse public signal, so most accounts are silent for months (product feels dead → churn) unless the threshold drops (noise → Slack channel muted by week 3). The fatal error is the silent miss: one tier-1 account that raised a round and got called by a competitor's rep before Tripwire pinged resets trust to zero, and exec-change recall without LinkedIn data cannot clear the bar the pitch sets. Pinned quotes fix hallucinated citations but not wrong-entity matches or misses. CHURN: the dossier does compound (this is not a 'caught up and cancel' product), but SMB sales tooling runs 3-5% monthly logo churn and this is the first line item cut in consolidation since Apollo/HubSpot/Clay each bundle adjacent signals; the converted-trigger feedback loop needs conversion volume a 5-rep SMB team generates too slowly to train a per-team model before churn risk peaks. The 'proprietary signal-to-revenue data' moat is real in principle but thin at SMB density, and Clay/Apollo observe orders of magnitude more conversion events. Net: survives the labs, gets squeezed by everyone adjacent.

## Tech Stack & Unit Economics

Ingestion: content-hash diff layer first (store SHA-256 of normalized page sections; only deltas reach any LLM) over raw-HTTP fetch of newsrooms/RSS/sitemaps; Firecrawl or Zyte fallback for JS/bot-walled pages; SEC EDGAR full-text + 8-K RSS (free, public-co accounts only); Greenhouse/Lever/Ashby public job-board JSON (free; Indeed/LinkedIn inaccessible — accept the coverage gap); news/funding via Exa or Tavily search API; exec-change signal requires licensed people-data (Live Data Technologies / Proxycurl-class) or must be dropped from the pitch; optional PredictLeads/TheirStack for jobs+tech-stack instead of BuiltWith minimums. Models: Haiku 4.5 via Anthropic Batches API (50% discount) with prompt caching on the ICP trigger profile for delta triage; Sonnet 4.6 batch for dossier synthesis and alert composition; citation grounding via extractive quote pinning with a hard string-match verification of quote-against-fetched-source before any alert fires (rejects hallucinated citations deterministically), plus domain-primary-key entity resolution to kill wrong-company pings. Memory: Postgres + pgvector, versioned per-account dossier snapshots. Orchestration: plain nightly cron + queue (pg-boss or Temporal) — no agent framework needed; the 'agent' is a pipeline. Surfaces: HubSpot public app (CRM card + timeline events) first, Slack app for push, Salesforce later; useful/converted feedback buttons writing to a relevance table feeding a per-team trigger-type reranker. Unit economics per account/month at promised breadth: LLM $0.03-0.08, search API $0.10-0.40, scraping $0.05-0.30, people-data $0.10-0.50, amortized vendor minimums $0.02-0.10 → realistic blended $0.30-1.00 (vs the claimed $0.10-0.30). Per 100-account seat: $30-100 COGS against $99 price (0-70% GM); the $499/1,000-account team plan is underwater unless exec-change and tech-stack signals are cut or repriced to ~$1.50-2.00 per additional account.
