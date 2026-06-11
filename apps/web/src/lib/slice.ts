import {
  baselineDocuments,
  createCostLedger,
  createMisquotingSynthesisClient,
  createMockSlackSink,
  createMockSynthesisClient,
  createMockTriageClient,
  createPipelineStore,
  demoAccounts,
  demoProfiles,
  demoSources,
  demoTeam,
  fundingNightDocuments,
  revopsNightDocuments,
  runNightly,
  type AlertPayload,
  type DeltaRecord,
  type DossierVersionRecord,
  type NightlyRunInput,
  type NightlyRunReport,
  type TriggerEventRecord,
} from '@tripwire/pipeline';
import type { Account, CostCategory, CostEntry, TriggerProfile } from '@tripwire/core';

/**
 * Runs the deterministic M1 slice (fixtures + mocked models, no network, no keys)
 * and shapes the result for the read-only brief. Fixed timestamps keep the build
 * reproducible byte-for-byte.
 */

const NIGHTS = [
  { now: '2026-06-08T02:00:00.000Z', documents: baselineDocuments },
  { now: '2026-06-09T02:00:00.000Z', documents: fundingNightDocuments },
  { now: '2026-06-10T02:00:00.000Z', documents: revopsNightDocuments },
] as const;

export interface BriefData {
  readonly teamName: string;
  readonly profiles: readonly TriggerProfile[];
  readonly accounts: readonly Account[];
  readonly reports: readonly NightlyRunReport[];
  readonly alerts: readonly AlertPayload[];
  readonly events: readonly TriggerEventRecord[];
  readonly dossiers: readonly DossierVersionRecord[];
  readonly ledgerEntries: readonly CostEntry[];
  readonly ledgerTotals: Readonly<Record<CostCategory, number>>;
  readonly lastCheckedAt: Readonly<Record<string, string>>;
  readonly blockedExample: DeltaRecord | undefined;
}

const baseInput = () => ({
  team: demoTeam,
  accounts: demoAccounts,
  sources: demoSources,
  profiles: demoProfiles,
  triage: createMockTriageClient(),
});

export const buildBrief = async (): Promise<BriefData> => {
  const store = createPipelineStore();
  const ledger = createCostLedger();
  const sink = createMockSlackSink();
  const reports: NightlyRunReport[] = [];

  for (const nightRun of NIGHTS) {
    const input: NightlyRunInput = {
      ...baseInput(),
      documents: nightRun.documents(),
      now: nightRun.now,
      synthesis: createMockSynthesisClient(),
      alertSink: sink,
      store,
      ledger,
    };
    reports.push(await runNightly(input));
  }

  const lastReport = reports[reports.length - 1];
  return {
    teamName: demoTeam.name,
    profiles: demoProfiles,
    accounts: demoAccounts,
    reports,
    alerts: sink.delivered(),
    events: store.triggerEvents(),
    dossiers: store.dossierVersions(),
    ledgerEntries: ledger.entries(),
    ledgerTotals: ledger.totalsByCategory(),
    lastCheckedAt: lastReport?.lastCheckedAt ?? {},
    blockedExample: await buildBlockedExample(),
  };
};

/**
 * A second, isolated timeline where synthesis paraphrases the quote: the gate
 * blocks it twice and the alert never leaves the internal review queue — the
 * brief shows what reps are protected from (M1 acceptance c).
 */
const buildBlockedExample = async (): Promise<DeltaRecord | undefined> => {
  const store = createPipelineStore();
  const ledger = createCostLedger();
  const sink = createMockSlackSink();
  for (const nightRun of NIGHTS.slice(0, 2)) {
    await runNightly({
      ...baseInput(),
      documents: nightRun.documents(),
      now: nightRun.now,
      synthesis: createMisquotingSynthesisClient(),
      alertSink: sink,
      store,
      ledger,
    });
  }
  return store.deltas().find((delta) => delta.status === 'gate_blocked');
};

/** `2026-06-09T02:00:00.000Z` → `09 Jun 2026 · 02:00 UTC` (locale-free). */
export const formatStamp = (iso: string): string => {
  const MONTHS = [
    'Jan',
    'Feb',
    'Mar',
    'Apr',
    'May',
    'Jun',
    'Jul',
    'Aug',
    'Sep',
    'Oct',
    'Nov',
    'Dec',
  ];
  const day = iso.slice(8, 10);
  const month = MONTHS[Number(iso.slice(5, 7)) - 1] ?? '???';
  return `${day} ${month} ${iso.slice(0, 4)} · ${iso.slice(11, 16)} UTC`;
};

export const sourceSlug = (url: string): string => {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
};
