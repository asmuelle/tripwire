import type { Team, TriggerProfile } from './types.js';

/**
 * Threshold / reranker-weight logic for delta triage. The model produces raw scores;
 * everything that decides whether a rep gets pinged is deterministic code here.
 */

export type TriageDecision = 'promoted' | 'below_threshold';

const clamp01 = (value: number): number => Math.min(1, Math.max(0, value));

/**
 * Product invariant 4: trigger profiles with requiresPeopleData stay disabled unless
 * the team has a licensed people-data provider. Filtering happens BEFORE any model
 * sees the profile — an unlicensed exec-change profile cannot even be scored.
 */
export const applicableProfiles = (
  profiles: readonly TriggerProfile[],
  team: Team,
): readonly TriggerProfile[] =>
  profiles.filter(
    (profile) => profile.enabled && (!profile.requiresPeopleData || team.peopleDataLicensed),
  );

/** Reranker-owned per-team weight applied to the raw model score. */
export const weightedScore = (rawScore: number, profileWeight: number): number =>
  clamp01(clamp01(rawScore) * profileWeight);

export const triageDecision = (score: number, alertThreshold: number): TriageDecision =>
  score >= alertThreshold ? 'promoted' : 'below_threshold';
