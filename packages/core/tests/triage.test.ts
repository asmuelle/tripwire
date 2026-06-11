import { describe, expect, test } from 'vitest';

import { applicableProfiles, triageDecision, weightedScore } from '../src/triage.js';
import type { Team, TriggerProfile } from '../src/types.js';

const team = (overrides: Partial<Team> = {}): Team => ({
  id: 'team_1',
  name: 'Crestline GTM',
  icpProfileText: 'Mid-market logistics; we sell RevOps tooling.',
  alertThreshold: 0.5,
  peopleDataLicensed: false,
  ...overrides,
});

const profile = (overrides: Partial<TriggerProfile> = {}): TriggerProfile => ({
  id: 'tp_1',
  teamId: 'team_1',
  name: 'raised Series B',
  description: 'Account announced a Series B round',
  examples: ['Series B'],
  weight: 1,
  requiresPeopleData: false,
  enabled: true,
  ...overrides,
});

describe('applicableProfiles — product invariant 4 (people-data licensing gate)', () => {
  test('excludes requiresPeopleData profiles for an unlicensed team', () => {
    // Arrange
    const profiles = [
      profile(),
      profile({ id: 'tp_cfo', name: 'CFO changed', requiresPeopleData: true }),
    ];

    // Act
    const result = applicableProfiles(profiles, team());

    // Assert
    expect(result.map((p) => p.id)).toEqual(['tp_1']);
  });

  test('includes requiresPeopleData profiles when the team is licensed', () => {
    // Arrange
    const profiles = [profile({ id: 'tp_cfo', requiresPeopleData: true })];

    // Act
    const result = applicableProfiles(profiles, team({ peopleDataLicensed: true }));

    // Assert
    expect(result).toHaveLength(1);
  });

  test('excludes disabled profiles regardless of licensing', () => {
    // Act
    const result = applicableProfiles([profile({ enabled: false })], team());

    // Assert
    expect(result).toEqual([]);
  });
});

describe('weightedScore / triageDecision', () => {
  test('applies the reranker weight and clamps into [0, 1]', () => {
    expect(weightedScore(0.8, 0.5)).toBeCloseTo(0.4);
    expect(weightedScore(0.9, 2)).toBe(1);
    expect(weightedScore(-1, 1)).toBe(0);
  });

  test('promotes at or above the threshold, holds below it', () => {
    expect(triageDecision(0.5, 0.5)).toBe('promoted');
    expect(triageDecision(0.49, 0.5)).toBe('below_threshold');
  });
});
