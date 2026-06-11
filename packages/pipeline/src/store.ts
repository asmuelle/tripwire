import type {
  CostCategory,
  CostEntry,
  DeltaStatus,
  GateBlockReason,
  RegisteredSourceKey,
  SectionDelta,
  SnapshotContent,
  SourceKind,
} from '@tripwire/core';
import { monthKey, sumByCategory } from '@tripwire/core';

/**
 * In-memory run state for the M1 slice. The shape mirrors the DESIGN.md data model
 * (snapshot, delta, trigger_event, alert_delivery, dossier_version, cost_ledger) so
 * the Postgres-backed repositories in M2 can replace this without touching run.ts.
 * Append-only where the invariants demand it (feedback/dossier discipline).
 */

export interface SourceDef {
  readonly id: string;
  readonly accountId: string;
  readonly kind: SourceKind;
  readonly url: string;
  /** Invariant 2: the only thing that can bind this source to its account. */
  readonly registeredKey: RegisteredSourceKey;
}

export interface SnapshotRecord {
  readonly id: string;
  readonly sourceId: string;
  readonly fetchedAt: string;
  readonly content: SnapshotContent;
}

export interface DeltaRecord {
  readonly id: string;
  readonly sourceId: string;
  readonly accountId: string;
  readonly delta: SectionDelta;
  readonly detectedAt: string;
  readonly status: DeltaStatus;
  readonly triageScore?: number;
  readonly matchedProfileId?: string;
  readonly gateBlockReason?: GateBlockReason;
}

export interface TriggerEventRecord {
  readonly id: string;
  readonly accountId: string;
  readonly deltaId: string;
  readonly triggerProfileId: string;
  readonly score: number;
  readonly pinnedQuote: string;
  /** Invariant 1: NOT NULL before any delivery row exists. */
  readonly quoteVerifiedAt: string;
  readonly sourceUrl: string;
  readonly sourceFetchedAt: string;
  readonly suggestedAngle: string;
}

export interface AlertDeliveryRecord {
  readonly id: string;
  readonly triggerEventId: string;
  readonly channel: 'slack';
  readonly deliveredAt: string;
}

export interface DossierVersionRecord {
  readonly id: string;
  readonly accountId: string;
  readonly versionNo: number;
  readonly bodyMd: string;
  /** Invariant 7: every version cites the snapshot ids it draws from. */
  readonly citations: readonly string[];
  readonly createdAt: string;
}

export interface PipelineStore {
  appendSnapshot(record: Omit<SnapshotRecord, 'id'>): SnapshotRecord;
  latestSnapshot(sourceId: string): SnapshotRecord | undefined;
  appendDelta(record: Omit<DeltaRecord, 'id'>): DeltaRecord;
  setDeltaStatus(
    deltaId: string,
    status: DeltaStatus,
    patch?: Partial<Pick<DeltaRecord, 'triageScore' | 'matchedProfileId' | 'gateBlockReason'>>,
  ): DeltaRecord;
  appendTriggerEvent(record: Omit<TriggerEventRecord, 'id'>): TriggerEventRecord;
  appendDelivery(record: Omit<AlertDeliveryRecord, 'id'>): AlertDeliveryRecord;
  appendDossierVersion(
    record: Omit<DossierVersionRecord, 'id' | 'versionNo'>,
  ): DossierVersionRecord;
  snapshots(): readonly SnapshotRecord[];
  deltas(): readonly DeltaRecord[];
  triggerEvents(): readonly TriggerEventRecord[];
  deliveries(): readonly AlertDeliveryRecord[];
  dossierVersions(accountId?: string): readonly DossierVersionRecord[];
}

export const createPipelineStore = (): PipelineStore => {
  const snapshots: SnapshotRecord[] = [];
  const deltas: DeltaRecord[] = [];
  const triggerEvents: TriggerEventRecord[] = [];
  const deliveries: AlertDeliveryRecord[] = [];
  const dossiers: DossierVersionRecord[] = [];
  let nextId = 1;
  const id = (prefix: string): string => `${prefix}_${nextId++}`;

  return {
    appendSnapshot: (record) => {
      const row = { ...record, id: id('snap') };
      snapshots.push(row);
      return row;
    },
    latestSnapshot: (sourceId) =>
      [...snapshots].reverse().find((snapshot) => snapshot.sourceId === sourceId),
    appendDelta: (record) => {
      const row = { ...record, id: id('delta') };
      deltas.push(row);
      return row;
    },
    setDeltaStatus: (deltaId, status, patch = {}) => {
      const index = deltas.findIndex((delta) => delta.id === deltaId);
      const current = deltas[index];
      if (current === undefined) {
        throw new Error(`unknown delta: ${deltaId}`);
      }
      const updated = { ...current, ...patch, status };
      deltas[index] = updated;
      return updated;
    },
    appendTriggerEvent: (record) => {
      const row = { ...record, id: id('trig') };
      triggerEvents.push(row);
      return row;
    },
    appendDelivery: (record) => {
      const exists = triggerEvents.some((event) => event.id === record.triggerEventId);
      if (!exists) {
        // Invariant 1, enforced structurally: a delivery row requires a trigger event,
        // and a trigger event cannot be built without quoteVerifiedAt.
        throw new Error(`delivery refers to unknown trigger event: ${record.triggerEventId}`);
      }
      const row = { ...record, id: id('deliv') };
      deliveries.push(row);
      return row;
    },
    appendDossierVersion: (record) => {
      const versionNo =
        dossiers.filter((dossier) => dossier.accountId === record.accountId).length + 1;
      const row = { ...record, versionNo, id: id('dossier') };
      dossiers.push(row);
      return row;
    },
    snapshots: () => [...snapshots],
    deltas: () => [...deltas],
    triggerEvents: () => [...triggerEvents],
    deliveries: () => [...deliveries],
    dossierVersions: (accountId) =>
      dossiers.filter((dossier) => accountId === undefined || dossier.accountId === accountId),
  };
};

export interface CostLedger {
  append(entry: CostEntry): void;
  entries(): readonly CostEntry[];
  totalsByCategory(): Readonly<Record<CostCategory, number>>;
  spentInMonth(accountId: string, isoDate: string): number;
}

/** Append-only cost ledger (invariant 5: every external call writes a row). */
export const createCostLedger = (): CostLedger => {
  const rows: CostEntry[] = [];
  return {
    append: (entry) => {
      rows.push(entry);
    },
    entries: () => [...rows],
    totalsByCategory: () => sumByCategory(rows),
    spentInMonth: (accountId, isoDate) =>
      rows
        .filter((row) => row.accountId === accountId && monthKey(row.runDate) === monthKey(isoDate))
        .reduce((total, row) => total + row.usdCost, 0),
  };
};

export interface AlertPayload {
  readonly triggerEventId: string;
  readonly accountId: string;
  readonly accountName: string;
  readonly profileName: string;
  readonly pinnedQuote: string;
  readonly sourceUrl: string;
  readonly suggestedAngle: string;
  /** Invariant 6: every alert surface renders the feedback verdicts. */
  readonly feedbackOptions: readonly ['useful', 'not_useful', 'converted'];
}

export interface AlertSink {
  deliver(alert: AlertPayload): Promise<void>;
  delivered(): readonly AlertPayload[];
}

/** Deterministic Slack stand-in: records what would have been posted. */
export const createMockSlackSink = (): AlertSink => {
  const sent: AlertPayload[] = [];
  return {
    deliver: (alert) => {
      sent.push(alert);
      return Promise.resolve();
    },
    delivered: () => [...sent],
  };
};
