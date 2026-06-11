import type { Account, SectionDelta, Team, TriggerProfile } from '@tripwire/core';
import {
  BATCH_RATES,
  applicableProfiles,
  budgetCheck,
  buildSections,
  diffSnapshots,
  isBannedSourceHost,
  resolveEntity,
  snapshotFromSections,
  triageDecision,
  usdForUsage,
  verifyQuote,
  weightedScore,
} from '@tripwire/core';

import type { SynthesisClient, SynthesisDraft, TriageClient } from './llm.js';
import { parseGreenhouseJobs, parseNewsroomRss } from './parsers.js';
import type { AlertSink, CostLedger, DeltaRecord, PipelineStore, SourceDef } from './store.js';

/**
 * The nightly run, as deterministic orchestration over the core domain functions:
 * fetch(fixture) → normalize/hash → diff → triage → synthesis → gates → deliver.
 * Inngest wraps exactly this function in M2; nothing here imports Inngest types.
 */

export interface NightlyRunInput {
  readonly team: Team;
  readonly accounts: readonly Account[];
  readonly sources: readonly SourceDef[];
  /** sourceId → raw fetched document body (checked-in fixtures in M1). */
  readonly documents: ReadonlyMap<string, string>;
  readonly profiles: readonly TriggerProfile[];
  /** ISO instant used for every timestamp in the run — keeps runs reproducible. */
  readonly now: string;
  readonly triage: TriageClient;
  readonly synthesis: SynthesisClient;
  readonly alertSink: AlertSink;
  readonly store: PipelineStore;
  readonly ledger: CostLedger;
}

export interface NightlyRunReport {
  readonly runDate: string;
  readonly accountsMonitored: number;
  readonly fetches: number;
  readonly fetchFailures: readonly string[];
  readonly deltasDetected: number;
  readonly deltasTriaged: number;
  readonly alertsDelivered: number;
  readonly gateBlocked: number;
  /** Invariant 10: silence shows evidence — last-checked per monitored account. */
  readonly lastCheckedAt: Readonly<Record<string, string>>;
}

interface IngestResult {
  readonly pendingDeltas: readonly DeltaRecord[];
  readonly snapshotIdBySource: ReadonlyMap<string, string>;
  readonly urlByDeltaId: ReadonlyMap<string, string>;
  readonly fetches: number;
  readonly fetchFailures: readonly string[];
}

const parseByKind = (source: SourceDef, body: string) => {
  switch (source.kind) {
    case 'newsroom_rss':
      return parseNewsroomRss(body);
    case 'ats_greenhouse':
      return parseGreenhouseJobs(body);
    default:
      throw new Error(`source kind not supported in the M1 slice: ${source.kind}`);
  }
};

const isSignalDelta = (delta: SectionDelta): boolean => delta.kind !== 'section_removed';

const ingestSources = (input: NightlyRunInput): IngestResult => {
  const pendingDeltas: DeltaRecord[] = [];
  const snapshotIdBySource = new Map<string, string>();
  const urlByDeltaId = new Map<string, string>();
  const fetchFailures: string[] = [];
  let fetches = 0;

  for (const source of input.sources) {
    if (isBannedSourceHost(source.url)) {
      throw new Error(`banned source host (invariant 4): ${source.url}`);
    }
    const body = input.documents.get(source.id);
    if (body === undefined) {
      fetchFailures.push(source.id);
      continue;
    }
    fetches += 1;
    const items = parseByKind(source, body);
    const urlByKey = new Map(items.map((item) => [item.key, item.url]));
    const snapshot = snapshotFromSections(buildSections(items));
    const prev = input.store.latestSnapshot(source.id);
    const deltas = diffSnapshots(prev?.content, snapshot);
    const record = input.store.appendSnapshot({
      sourceId: source.id,
      fetchedAt: input.now,
      content: snapshot,
    });
    snapshotIdBySource.set(source.id, record.id);

    for (const delta of deltas) {
      const row = input.store.appendDelta({
        sourceId: source.id,
        accountId: source.accountId,
        delta,
        detectedAt: input.now,
        status: 'pending',
      });
      if (isSignalDelta(delta)) {
        pendingDeltas.push(row);
        urlByDeltaId.set(row.id, urlByKey.get(delta.sectionKey) ?? source.url);
      } else {
        input.store.setDeltaStatus(row.id, 'below_threshold', { triageScore: 0 });
      }
    }
  }
  return { pendingDeltas, snapshotIdBySource, urlByDeltaId, fetches, fetchFailures };
};

const runDateOf = (nowIso: string): string => nowIso.slice(0, 10);

const ledgerLlmEntry = (
  input: NightlyRunInput,
  accountId: string,
  usage: { inputTokens: number; outputTokens: number },
  rates: (typeof BATCH_RATES)['haiku'],
  note: string,
) => {
  input.ledger.append({
    accountId,
    runDate: runDateOf(input.now),
    category: 'llm',
    units: usage.inputTokens + usage.outputTokens,
    usdCost: usdForUsage(usage, rates),
    note,
  });
};

/** Pre-spend budget gate (invariant 5): block the call, never just warn. */
const underBudget = (input: NightlyRunInput, account: Account, estimatedUsd: number): boolean => {
  const spent = input.ledger.spentInMonth(account.id, runDateOf(input.now));
  return budgetCheck(spent, estimatedUsd, account.monthlyBudgetUsd).allowed;
};

interface TriagedDelta {
  readonly delta: DeltaRecord;
  readonly profile: TriggerProfile;
  readonly score: number;
}

const triageAccountDeltas = async (
  input: NightlyRunInput,
  account: Account,
  deltas: readonly DeltaRecord[],
): Promise<readonly TriagedDelta[]> => {
  const profiles = applicableProfiles(input.profiles, input.team);
  const requests = deltas.map((row) => ({
    deltaId: row.id,
    deltaText: row.delta.text,
    icpProfileText: input.team.icpProfileText,
    profiles,
  }));
  const estimatedUsd = usdForUsage(
    { inputTokens: requests.reduce((sum, r) => sum + r.deltaText.length / 4, 0), outputTokens: 64 },
    BATCH_RATES.haiku,
  );
  if (!underBudget(input, account, estimatedUsd)) {
    for (const row of deltas) {
      input.store.setDeltaStatus(row.id, 'gate_blocked', { gateBlockReason: 'budget_exceeded' });
    }
    return [];
  }

  const scores = await input.triage.scoreDeltas(requests);
  const promoted: TriagedDelta[] = [];
  for (const score of scores) {
    ledgerLlmEntry(input, account.id, score.usage, BATCH_RATES.haiku, 'haiku triage batch');
    const row = deltas.find((candidate) => candidate.id === score.deltaId);
    const profile = profiles.find((candidate) => candidate.id === score.profileId);
    if (row === undefined) {
      continue;
    }
    const weighted = profile === undefined ? 0 : weightedScore(score.rawScore, profile.weight);
    if (
      profile !== undefined &&
      triageDecision(weighted, input.team.alertThreshold) === 'promoted'
    ) {
      input.store.setDeltaStatus(row.id, 'promoted', {
        triageScore: weighted,
        matchedProfileId: profile.id,
      });
      promoted.push({ delta: row, profile, score: weighted });
    } else {
      input.store.setDeltaStatus(row.id, 'below_threshold', { triageScore: weighted });
    }
  }
  return promoted;
};

export const runNightly = async (input: NightlyRunInput): Promise<NightlyRunReport> => {
  const activeAccounts = input.accounts.filter((account) => account.status === 'active');
  const accountById = new Map(activeAccounts.map((account) => [account.id, account]));
  const activeSources = input.sources.filter((source) => accountById.has(source.accountId));
  const scopedInput = { ...input, sources: activeSources };

  const ingest = ingestSources(scopedInput);
  let alertsDelivered = 0;
  let deltasTriaged = 0;

  for (const account of activeAccounts) {
    const accountDeltas = ingest.pendingDeltas.filter((row) => row.accountId === account.id);
    if (accountDeltas.length === 0) {
      continue;
    }
    deltasTriaged += accountDeltas.length;
    const promoted = await triageAccountDeltas(input, account, accountDeltas);
    for (const triaged of promoted) {
      const delivered = await synthesizeAndGate(input, account, triaged, ingest);
      alertsDelivered += delivered ? 1 : 0;
    }
  }

  const lastCheckedAt = Object.fromEntries(
    activeAccounts.map((account) => [account.id, input.now]),
  );
  const gateBlocked = input.store.deltas().filter((row) => row.status === 'gate_blocked').length;
  return {
    runDate: runDateOf(input.now),
    accountsMonitored: activeAccounts.length,
    fetches: ingest.fetches,
    fetchFailures: ingest.fetchFailures,
    deltasDetected: ingest.pendingDeltas.length,
    deltasTriaged,
    alertsDelivered,
    gateBlocked,
    lastCheckedAt,
  };
};

const synthesizeAndGate = async (
  input: NightlyRunInput,
  account: Account,
  triaged: TriagedDelta,
  ingest: IngestResult,
): Promise<boolean> => {
  const source = input.sources.find((candidate) => candidate.id === triaged.delta.sourceId);
  const snapshotId = ingest.snapshotIdBySource.get(triaged.delta.sourceId);
  const snapshot = input.store.snapshots().find((row) => row.id === snapshotId);
  if (source === undefined || snapshot === undefined) {
    throw new Error(`delta ${triaged.delta.id} has no source/snapshot in this run`);
  }

  // Entity gate (invariant 2): deterministic, before any frontier spend.
  if (!resolveEntity(source, account).ok) {
    input.store.setDeltaStatus(triaged.delta.id, 'gate_blocked', {
      gateBlockReason: 'entity_mismatch',
    });
    return false;
  }

  const outcome = await synthesizeWithRepair(
    input,
    account,
    triaged,
    snapshot.content.normalizedText,
  );
  if (outcome.kind !== 'draft') {
    input.store.setDeltaStatus(triaged.delta.id, 'gate_blocked', {
      gateBlockReason:
        outcome.kind === 'budget_blocked' ? 'budget_exceeded' : 'quote_verification_failed',
    });
    return false;
  }
  const draft = outcome.draft;

  const event = input.store.appendTriggerEvent({
    accountId: account.id,
    deltaId: triaged.delta.id,
    triggerProfileId: triaged.profile.id,
    score: triaged.score,
    pinnedQuote: draft.pinnedQuote,
    quoteVerifiedAt: input.now,
    sourceUrl: ingest.urlByDeltaId.get(triaged.delta.id) ?? source.url,
    sourceFetchedAt: snapshot.fetchedAt,
    suggestedAngle: draft.suggestedAngle,
  });
  input.store.appendDossierVersion({
    accountId: account.id,
    bodyMd: draft.dossierSectionMd,
    citations: [snapshot.id],
    createdAt: input.now,
  });
  await input.alertSink.deliver({
    triggerEventId: event.id,
    accountId: account.id,
    accountName: account.name,
    profileName: triaged.profile.name,
    pinnedQuote: event.pinnedQuote,
    sourceUrl: event.sourceUrl,
    suggestedAngle: event.suggestedAngle,
    feedbackOptions: ['useful', 'not_useful', 'converted'],
  });
  input.store.appendDelivery({
    triggerEventId: event.id,
    channel: 'slack',
    deliveredAt: input.now,
  });
  input.store.setDeltaStatus(triaged.delta.id, 'delivered');
  return true;
};

type SynthesisOutcome =
  | { readonly kind: 'draft'; readonly draft: SynthesisDraft }
  | { readonly kind: 'budget_blocked' }
  | { readonly kind: 'quote_failed' };

/** One synthesis attempt + one "quote verbatim" repair retry (DESIGN.md trust gate). */
const synthesizeWithRepair = async (
  input: NightlyRunInput,
  account: Account,
  triaged: TriagedDelta,
  snapshotText: string,
): Promise<SynthesisOutcome> => {
  for (const repair of [false, true]) {
    const estimatedUsd = usdForUsage(
      { inputTokens: triaged.delta.delta.text.length / 4, outputTokens: 256 },
      BATCH_RATES.sonnet,
    );
    if (!underBudget(input, account, estimatedUsd)) {
      return { kind: 'budget_blocked' };
    }
    const [draft] = await input.synthesis.synthesize([
      {
        deltaId: triaged.delta.id,
        accountName: account.name,
        deltaText: triaged.delta.delta.text,
        profileName: triaged.profile.name,
        repair,
      },
    ]);
    if (draft === undefined) {
      throw new Error(`synthesis returned no draft for delta ${triaged.delta.id}`);
    }
    ledgerLlmEntry(input, account.id, draft.usage, BATCH_RATES.sonnet, 'sonnet synthesis batch');
    if (verifyQuote(draft.pinnedQuote, snapshotText).verified) {
      return { kind: 'draft', draft };
    }
  }
  return { kind: 'quote_failed' };
};
