import { getTableColumns, getTableName } from 'drizzle-orm';
import { describe, expect, test } from 'vitest';

import { account, snapshot, source, team } from '../src/schema.js';

/**
 * Schema-shape tests — no Postgres needed. Integration against the docker
 * pgvector container is M2 work; here we pin the column contract the pipeline
 * and the DESIGN.md data model agree on.
 */

describe('drizzle schema — M0 tables', () => {
  test('defines the four M0 tables with their DESIGN.md names', () => {
    expect(getTableName(team)).toBe('team');
    expect(getTableName(account)).toBe('account');
    expect(getTableName(source)).toBe('source');
    expect(getTableName(snapshot)).toBe('snapshot');
  });

  test('account carries the deterministic entity-resolution keys (invariant 2)', () => {
    // Arrange
    const columns = getTableColumns(account);

    // Assert
    expect(columns.primaryDomain.notNull).toBe(true);
    expect(columns.edgarCik.notNull).toBe(false);
    expect(columns.atsBoardToken.notNull).toBe(false);
    expect(columns.monthlyBudgetUsd.notNull).toBe(true);
  });

  test('snapshot stores the normalized text and content hash the gates depend on', () => {
    // Arrange
    const columns = getTableColumns(snapshot);

    // Assert — invariant 1 matches quotes against normalized_text; invariant 3
    // diffs on content_hash. Both must be non-nullable.
    expect(columns.contentHash.notNull).toBe(true);
    expect(columns.normalizedText.notNull).toBe(true);
    expect(columns.fetchedAt.notNull).toBe(true);
  });

  test('source tracks fetch health so silence is distinguishable from breakage (invariant 10)', () => {
    // Arrange
    const columns = getTableColumns(source);

    // Assert
    expect(columns.lastFetchedAt).toBeDefined();
    expect(columns.consecutiveFailures.notNull).toBe(true);
    expect(columns.enabled.notNull).toBe(true);
  });

  test('team gates people-data signals behind an explicit license flag (invariant 4)', () => {
    // Arrange
    const columns = getTableColumns(team);

    // Assert
    expect(columns.peopleDataLicensed.notNull).toBe(true);
    expect(columns.peopleDataLicensed.hasDefault).toBe(true);
  });
});
