import { describe, expect, test } from 'vitest';

import {
  BATCH_RATES,
  budgetCheck,
  estimateTokens,
  monthKey,
  sumByCategory,
  usdForUsage,
  type CostEntry,
} from '../src/cost-model.js';

describe('cost model — product invariant 5 (ledger + budget gate)', () => {
  test('estimates tokens at ~4 chars/token with a floor of 1', () => {
    expect(estimateTokens('abcdefgh')).toBe(2);
    expect(estimateTokens('')).toBe(1);
  });

  test('prices usage with the simulated batch rates', () => {
    // Arrange — 1M input + 1M output tokens at Haiku batch rates
    const usage = { inputTokens: 1_000_000, outputTokens: 1_000_000 };

    // Act
    const usd = usdForUsage(usage, BATCH_RATES.haiku);

    // Assert
    expect(usd).toBeCloseTo(3.0, 6);
  });

  test('sums ledger entries by category without mutating inputs', () => {
    // Arrange
    const entries: readonly CostEntry[] = [
      { accountId: 'a', runDate: '2026-06-10', category: 'llm', units: 100, usdCost: 0.001 },
      { accountId: 'a', runDate: '2026-06-10', category: 'llm', units: 200, usdCost: 0.002 },
      { accountId: 'a', runDate: '2026-06-10', category: 'search', units: 1, usdCost: 0.005 },
    ];

    // Act
    const totals = sumByCategory(entries);

    // Assert
    expect(totals.llm).toBeCloseTo(0.003, 9);
    expect(totals.search).toBeCloseTo(0.005, 9);
    expect(totals.scrape).toBe(0);
    expect(totals.people_data).toBe(0);
  });

  test('budget gate allows spend up to the cap and blocks beyond it', () => {
    expect(budgetCheck(0.4, 0.1, 0.5)).toEqual({ allowed: true });
    expect(budgetCheck(0.45, 0.1, 0.5)).toEqual({
      allowed: false,
      reason: 'monthly_budget_exceeded',
    });
  });

  test('monthKey buckets ISO dates by month', () => {
    expect(monthKey('2026-06-10')).toBe('2026-06');
  });
});
