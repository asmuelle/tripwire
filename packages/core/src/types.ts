/**
 * Core domain types — pure data, no I/O (AGENTS.md architecture rules).
 */

export type SourceKind =
  | 'newsroom_rss'
  | 'sitemap'
  | 'edgar_8k'
  | 'ats_greenhouse'
  | 'ats_lever'
  | 'ats_ashby'
  | 'news_search';

export type RegisteredKeyType = 'primary_domain' | 'edgar_cik' | 'ats_board_token';

/** The only keys that may bind a source to an account (product invariant 2). */
export interface RegisteredSourceKey {
  readonly type: RegisteredKeyType;
  readonly value: string;
}

export interface Team {
  readonly id: string;
  readonly name: string;
  readonly icpProfileText: string;
  /** Weighted triage score required before synthesis/alerting. */
  readonly alertThreshold: number;
  /** Product invariant 4: exec-change profiles stay off unless this is true. */
  readonly peopleDataLicensed: boolean;
}

export type AccountStatus = 'active' | 'paused';

export interface Account {
  readonly id: string;
  readonly teamId: string;
  readonly name: string;
  /** Entity-resolution key; unique per team. */
  readonly primaryDomain: string;
  readonly edgarCik?: string;
  readonly atsBoardToken?: string;
  readonly status: AccountStatus;
  readonly monthlyBudgetUsd: number;
}

export interface TriggerProfile {
  readonly id: string;
  readonly teamId: string;
  readonly name: string;
  readonly description: string;
  /** Deterministic keyword examples; also drive the mock triage model. */
  readonly examples: readonly string[];
  /** Reranker-owned weight applied to raw triage scores. */
  readonly weight: number;
  readonly requiresPeopleData: boolean;
  readonly enabled: boolean;
}

/** One normalized, hashable unit of a fetched document (an RSS item, a job posting…). */
export interface Section {
  readonly key: string;
  readonly text: string;
  readonly hash: string;
}

export interface SnapshotContent {
  readonly sections: readonly Section[];
  /** Order-insensitive hash over section hashes — the diff firewall key. */
  readonly contentHash: string;
  /** Normalized full text; the quote gate matches against exactly this. */
  readonly normalizedText: string;
}

export type SectionDeltaKind = 'section_added' | 'section_changed' | 'section_removed';

export interface SectionDelta {
  readonly kind: SectionDeltaKind;
  readonly sectionKey: string;
  /** Current text for added/changed; previous text for removed. */
  readonly text: string;
  readonly prevHash?: string;
  readonly currHash?: string;
}

export type DeltaStatus = 'pending' | 'below_threshold' | 'promoted' | 'gate_blocked' | 'delivered';

export type GateBlockReason = 'quote_verification_failed' | 'entity_mismatch' | 'budget_exceeded';
