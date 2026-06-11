/**
 * Per-call USD attribution + budget gate (product invariant 5: every external call
 * writes to the cost ledger; spend halts at the account's monthly budget).
 */

export type CostCategory = 'llm' | 'search' | 'scrape' | 'people_data';

export interface CostEntry {
  readonly accountId: string;
  /** ISO date (YYYY-MM-DD) of the run that incurred the cost. */
  readonly runDate: string;
  readonly category: CostCategory;
  readonly units: number;
  readonly usdCost: number;
  readonly note?: string;
}

export interface TokenUsage {
  readonly inputTokens: number;
  readonly outputTokens: number;
}

export interface ModelRates {
  readonly inputPerMTokUsd: number;
  readonly outputPerMTokUsd: number;
}

/**
 * Simulated Anthropic Batches rates (50% of list, USD per million tokens) used by the
 * deterministic mock client's cost attribution. Confirm against live pricing when the
 * real Batches client lands in M2 — these are cost-model constants, not billing truth.
 */
export const BATCH_RATES: Readonly<Record<'haiku' | 'sonnet', ModelRates>> = {
  haiku: { inputPerMTokUsd: 0.5, outputPerMTokUsd: 2.5 },
  sonnet: { inputPerMTokUsd: 1.5, outputPerMTokUsd: 7.5 },
};

const TOKENS_PER_CHAR = 1 / 4;
const USD_PRECISION = 6;

export const estimateTokens = (text: string): number =>
  Math.max(1, Math.ceil(text.length * TOKENS_PER_CHAR));

export const usdForUsage = (usage: TokenUsage, rates: ModelRates): number => {
  const usd =
    (usage.inputTokens / 1_000_000) * rates.inputPerMTokUsd +
    (usage.outputTokens / 1_000_000) * rates.outputPerMTokUsd;
  return Number(usd.toFixed(USD_PRECISION));
};

export const sumByCategory = (
  entries: readonly CostEntry[],
): Readonly<Record<CostCategory, number>> =>
  entries.reduce<Record<CostCategory, number>>(
    (totals, entry) => ({ ...totals, [entry.category]: totals[entry.category] + entry.usdCost }),
    { llm: 0, search: 0, scrape: 0, people_data: 0 },
  );

export const monthKey = (isoDate: string): string => isoDate.slice(0, 7);

export type BudgetCheck =
  | { readonly allowed: true }
  | { readonly allowed: false; readonly reason: 'monthly_budget_exceeded' };

export const budgetCheck = (
  spentThisMonthUsd: number,
  proposedUsd: number,
  monthlyBudgetUsd: number,
): BudgetCheck =>
  spentThisMonthUsd + proposedUsd <= monthlyBudgetUsd
    ? { allowed: true }
    : { allowed: false, reason: 'monthly_budget_exceeded' };
