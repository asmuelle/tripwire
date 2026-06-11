import { verifyQuote } from '@tripwire/core';
import { describe, expect, test } from 'vitest';

import {
  createMisquotingSynthesisClient,
  createMockSynthesisClient,
  createMockTriageClient,
  createRepairableSynthesisClient,
} from '../src/llm.js';
import { runNightly, type NightlyRunInput } from '../src/run.js';
import {
  NORVANE_ACCOUNT_ID,
  PROFILE_EXEC_CHANGE_ID,
  PROFILE_FUNDING_ID,
  PROFILE_REVOPS_ID,
  baselineDocuments,
  cfoNightDocuments,
  demoAccounts,
  demoProfiles,
  demoSources,
  demoTeam,
  fundingNightDocuments,
  revopsNightDocuments,
} from '../src/seed.js';
import {
  createCostLedger,
  createMockSlackSink,
  createPipelineStore,
  type SourceDef,
} from '../src/store.js';

const NIGHT_0 = '2026-06-08T02:00:00.000Z';
const NIGHT_1 = '2026-06-09T02:00:00.000Z';

const must = <T>(value: T | undefined, label: string): T => {
  if (value === undefined) {
    throw new Error(`expected ${label} to be defined`);
  }
  return value;
};

const makeHarness = () => ({
  store: createPipelineStore(),
  ledger: createCostLedger(),
  sink: createMockSlackSink(),
});

type Harness = ReturnType<typeof makeHarness>;

const night = (
  harness: Harness,
  documents: ReadonlyMap<string, string>,
  now: string,
  overrides: Partial<NightlyRunInput> = {},
) =>
  runNightly({
    team: demoTeam,
    accounts: demoAccounts,
    sources: demoSources,
    documents,
    profiles: demoProfiles,
    now,
    triage: createMockTriageClient(),
    synthesis: createMockSynthesisClient(),
    alertSink: harness.sink,
    store: harness.store,
    ledger: harness.ledger,
    ...overrides,
  });

describe('nightly run — baseline (night 0)', () => {
  test('first fetch is a baseline: snapshots stored, zero deltas, zero LLM spend', async () => {
    // Arrange
    const harness = makeHarness();

    // Act
    const report = await night(harness, baselineDocuments(), NIGHT_0);

    // Assert — onboarding must not alert-storm and must not spend
    expect(report.accountsMonitored).toBe(10);
    expect(report.fetches).toBe(11);
    expect(report.deltasDetected).toBe(0);
    expect(report.alertsDelivered).toBe(0);
    expect(harness.ledger.entries()).toHaveLength(0);
    expect(harness.store.snapshots()).toHaveLength(11);
  });

  test('invariant 10: every monitored account gets a last-checked timestamp, even quiet ones', async () => {
    // Arrange
    const harness = makeHarness();

    // Act
    const report = await night(harness, baselineDocuments(), NIGHT_0);

    // Assert
    for (const account of demoAccounts) {
      expect(report.lastCheckedAt[account.id]).toBe(NIGHT_0);
    }
  });

  test('a missing document is recorded as a fetch failure, not silently skipped', async () => {
    // Arrange
    const harness = makeHarness();
    const documents = new Map(baselineDocuments());
    documents.delete('src_quiet_1');

    // Act
    const report = await night(harness, documents, NIGHT_0);

    // Assert
    expect(report.fetchFailures).toEqual(['src_quiet_1']);
    expect(report.fetches).toBe(10);
  });
});

describe('M1 acceptance (b) — unchanged fixtures cost $0.00 in LLM spend', () => {
  test('a second run over identical fixtures produces zero deltas and an empty llm ledger', async () => {
    // Arrange
    const harness = makeHarness();
    await night(harness, baselineDocuments(), NIGHT_0);

    // Act
    const report = await night(harness, baselineDocuments(), NIGHT_1);

    // Assert — invariant 3: diff before LLM
    expect(report.deltasDetected).toBe(0);
    expect(report.alertsDelivered).toBe(0);
    expect(harness.ledger.totalsByCategory().llm).toBe(0);
    expect(harness.ledger.entries().filter((entry) => entry.category === 'llm')).toHaveLength(0);
  });
});

describe('M1 acceptance (a) — mutated newsroom fires exactly one verified alert', () => {
  const runFundingNight = async () => {
    const harness = makeHarness();
    await night(harness, baselineDocuments(), NIGHT_0);
    const report = await night(harness, fundingNightDocuments(), NIGHT_1);
    return { harness, report };
  };

  test('exactly one Slack alert is delivered, for the funding trigger', async () => {
    // Act
    const { harness, report } = await runFundingNight();

    // Assert
    expect(report.deltasDetected).toBe(1);
    expect(report.alertsDelivered).toBe(1);
    expect(harness.sink.delivered()).toHaveLength(1);
    const alert = must(harness.sink.delivered()[0], 'delivered alert');
    expect(alert.accountId).toBe(NORVANE_ACCOUNT_ID);
    expect(alert.profileName).toBe('Raised a funding round');
    expect(alert.sourceUrl).toContain('norvane.example/press/series-b-announcement');
  });

  test('invariant 1: the pinned quote exact-string-matches the stored snapshot text', async () => {
    // Act
    const { harness } = await runFundingNight();

    // Assert — re-verify with the deterministic gate against the cited snapshot
    const event = must(harness.store.triggerEvents()[0], 'trigger event');
    const dossier = must(harness.store.dossierVersions(NORVANE_ACCOUNT_ID)[0], 'dossier version');
    const citedSnapshotId = must(dossier.citations[0], 'citation');
    const snapshot = must(
      harness.store.snapshots().find((row) => row.id === citedSnapshotId),
      'cited snapshot',
    );
    expect(event.quoteVerifiedAt).toBe(NIGHT_1);
    expect(verifyQuote(event.pinnedQuote, snapshot.content.normalizedText).verified).toBe(true);
    expect(event.pinnedQuote).toContain('$24 million Series B');
  });

  test('invariant 1: a delivery row exists only for a trigger event with quoteVerifiedAt set', async () => {
    // Act
    const { harness } = await runFundingNight();

    // Assert
    const deliveries = harness.store.deliveries();
    expect(deliveries).toHaveLength(1);
    for (const delivery of deliveries) {
      const event = must(
        harness.store.triggerEvents().find((row) => row.id === delivery.triggerEventId),
        'event for delivery',
      );
      expect(event.quoteVerifiedAt).not.toBe('');
    }
  });

  test('invariant 6: the alert surface carries the three feedback verdicts', async () => {
    // Act
    const { harness } = await runFundingNight();

    // Assert
    const alert = must(harness.sink.delivered()[0], 'delivered alert');
    expect(alert.feedbackOptions).toEqual(['useful', 'not_useful', 'converted']);
  });

  test('invariant 5: every model call wrote an llm cost_ledger row attributed to the account', async () => {
    // Act
    const { harness } = await runFundingNight();

    // Assert — one haiku triage entry + one sonnet synthesis entry
    const llmEntries = harness.ledger.entries().filter((entry) => entry.category === 'llm');
    expect(llmEntries).toHaveLength(2);
    expect(llmEntries.map((entry) => entry.note)).toEqual([
      'haiku triage batch',
      'sonnet synthesis batch',
    ]);
    for (const entry of llmEntries) {
      expect(entry.accountId).toBe(NORVANE_ACCOUNT_ID);
      expect(entry.usdCost).toBeGreaterThan(0);
      expect(entry.runDate).toBe('2026-06-09');
    }
  });

  test('invariant 7: the dossier version is append-only, versioned, and cited', async () => {
    // Arrange
    const { harness } = await runFundingNight();

    // Act — a second mutated night (RevOps posting) appends, never updates
    await night(harness, revopsNightDocuments(), '2026-06-10T02:00:00.000Z');

    // Assert
    const versions = harness.store.dossierVersions(NORVANE_ACCOUNT_ID);
    expect(versions.map((version) => version.versionNo)).toEqual([1, 2]);
    for (const version of versions) {
      expect(version.citations.length).toBeGreaterThan(0);
    }
  });
});

describe('M1 acceptance (c) — misquoted synthesis is gate_blocked, never delivered', () => {
  test('a paraphrasing synthesis client fails the quote gate twice and the alert is blocked', async () => {
    // Arrange
    const harness = makeHarness();
    const synthesis = createMisquotingSynthesisClient();
    await night(harness, baselineDocuments(), NIGHT_0, { synthesis });

    // Act
    const report = await night(harness, fundingNightDocuments(), NIGHT_1, { synthesis });

    // Assert
    expect(report.alertsDelivered).toBe(0);
    expect(report.gateBlocked).toBe(1);
    expect(harness.sink.delivered()).toHaveLength(0);
    expect(harness.store.deliveries()).toHaveLength(0);
    expect(harness.store.triggerEvents()).toHaveLength(0);
    const blocked = must(
      harness.store.deltas().find((row) => row.status === 'gate_blocked'),
      'blocked delta',
    );
    expect(blocked.gateBlockReason).toBe('quote_verification_failed');
    // Attempt + repair retry both happened and both wrote ledger rows
    const sonnetEntries = harness.ledger
      .entries()
      .filter((entry) => entry.note === 'sonnet synthesis batch');
    expect(sonnetEntries).toHaveLength(2);
  });

  test('a synthesis client that repairs on retry is delivered after the second attempt', async () => {
    // Arrange
    const harness = makeHarness();
    const synthesis = createRepairableSynthesisClient();
    await night(harness, baselineDocuments(), NIGHT_0, { synthesis });

    // Act
    const report = await night(harness, fundingNightDocuments(), NIGHT_1, { synthesis });

    // Assert
    expect(report.alertsDelivered).toBe(1);
    const sonnetEntries = harness.ledger
      .entries()
      .filter((entry) => entry.note === 'sonnet synthesis batch');
    expect(sonnetEntries).toHaveLength(2);
    const event = must(harness.store.triggerEvents()[0], 'trigger event');
    expect(verifyQuote(event.pinnedQuote, event.pinnedQuote).verified).toBe(true);
  });
});

describe('triage routing', () => {
  test('the RevOps ATS posting routes to the first-RevOps trigger profile', async () => {
    // Arrange
    const harness = makeHarness();
    await night(harness, baselineDocuments(), NIGHT_0);

    // Act
    const report = await night(harness, revopsNightDocuments(), NIGHT_1);

    // Assert
    expect(report.alertsDelivered).toBe(1);
    const event = must(harness.store.triggerEvents()[0], 'trigger event');
    expect(event.triggerProfileId).toBe(PROFILE_REVOPS_ID);
    const alert = must(harness.sink.delivered()[0], 'alert');
    expect(alert.sourceUrl).toContain('greenhouse.io/norvanesystems/jobs/7011004');
  });

  test('the funding delta routes to the funding profile, not the RevOps profile', async () => {
    // Arrange
    const harness = makeHarness();
    await night(harness, baselineDocuments(), NIGHT_0);

    // Act
    await night(harness, fundingNightDocuments(), NIGHT_1);

    // Assert
    const event = must(harness.store.triggerEvents()[0], 'trigger event');
    expect(event.triggerProfileId).toBe(PROFILE_FUNDING_ID);
  });
});

describe('invariant 4 — exec-change signals are off without a people-data license', () => {
  test('an unlicensed team never alerts on the CFO appointment', async () => {
    // Arrange — demoTeam has peopleDataLicensed: false
    const harness = makeHarness();
    await night(harness, baselineDocuments(), NIGHT_0);

    // Act
    const report = await night(harness, cfoNightDocuments(), NIGHT_1);

    // Assert — the delta exists but no profile may score it
    expect(report.deltasDetected).toBe(1);
    expect(report.alertsDelivered).toBe(0);
    expect(harness.sink.delivered()).toHaveLength(0);
    const delta = must(harness.store.deltas()[0], 'cfo delta');
    expect(delta.status).toBe('below_threshold');
  });

  test('a licensed team receives the exec-change alert', async () => {
    // Arrange
    const harness = makeHarness();
    const team = { ...demoTeam, peopleDataLicensed: true };
    await night(harness, baselineDocuments(), NIGHT_0, { team });

    // Act
    const report = await night(harness, cfoNightDocuments(), NIGHT_1, { team });

    // Assert
    expect(report.alertsDelivered).toBe(1);
    const event = must(harness.store.triggerEvents()[0], 'trigger event');
    expect(event.triggerProfileId).toBe(PROFILE_EXEC_CHANGE_ID);
  });
});

describe('invariant 2 — entity gate blocks a mis-registered source deterministically', () => {
  test('a source whose registered key does not match the account is gate_blocked', async () => {
    // Arrange — the source claims Norvane's account id but is keyed to another domain
    const harness = makeHarness();
    const misregistered: SourceDef = {
      id: 'src_norvane_newsroom',
      accountId: NORVANE_ACCOUNT_ID,
      kind: 'newsroom_rss',
      url: 'https://rivalcorp.example/press/rss.xml',
      registeredKey: { type: 'primary_domain', value: 'rivalcorp.example' },
    };
    const overrides = { sources: [misregistered] };
    await night(harness, baselineDocuments(), NIGHT_0, overrides);

    // Act
    const report = await night(harness, fundingNightDocuments(), NIGHT_1, overrides);

    // Assert
    expect(report.alertsDelivered).toBe(0);
    expect(harness.store.deliveries()).toHaveLength(0);
    const blocked = must(harness.store.deltas()[0], 'delta');
    expect(blocked.status).toBe('gate_blocked');
    expect(blocked.gateBlockReason).toBe('entity_mismatch');
  });
});

describe('invariant 5 — per-account budget gate halts spend', () => {
  test('a zero-budget account gets gate_blocked before any model call', async () => {
    // Arrange
    const accounts = demoAccounts.map((account) =>
      account.id === NORVANE_ACCOUNT_ID ? { ...account, monthlyBudgetUsd: 0 } : account,
    );
    const harness = makeHarness();
    await night(harness, baselineDocuments(), NIGHT_0, { accounts });

    // Act
    const report = await night(harness, fundingNightDocuments(), NIGHT_1, { accounts });

    // Assert — no LLM ledger rows at all: the call was blocked, not just the alert
    expect(report.alertsDelivered).toBe(0);
    expect(harness.ledger.entries()).toHaveLength(0);
    const blocked = must(harness.store.deltas()[0], 'delta');
    expect(blocked.status).toBe('gate_blocked');
    expect(blocked.gateBlockReason).toBe('budget_exceeded');
  });
});

describe('invariant 4 — banned hosts can never be fetched', () => {
  test('a LinkedIn-hosted source aborts the run loudly', async () => {
    // Arrange
    const harness = makeHarness();
    const banned: SourceDef = {
      id: 'src_banned',
      accountId: NORVANE_ACCOUNT_ID,
      kind: 'newsroom_rss',
      url: 'https://www.linkedin.com/company/norvane/posts/',
      registeredKey: { type: 'primary_domain', value: 'norvane.example' },
    };

    // Act + Assert
    await expect(
      night(harness, baselineDocuments(), NIGHT_0, { sources: [banned] }),
    ).rejects.toThrow(/banned source host/);
  });
});

describe('paused accounts', () => {
  test('a paused account is not fetched and gets no last-checked entry', async () => {
    // Arrange
    const accounts = demoAccounts.map((account) =>
      account.id === NORVANE_ACCOUNT_ID ? { ...account, status: 'paused' as const } : account,
    );
    const harness = makeHarness();

    // Act
    const report = await night(harness, baselineDocuments(), NIGHT_0, { accounts });

    // Assert — only the 9 quiet accounts were monitored
    expect(report.accountsMonitored).toBe(9);
    expect(report.fetches).toBe(9);
    expect(report.lastCheckedAt[NORVANE_ACCOUNT_ID]).toBeUndefined();
  });
});
