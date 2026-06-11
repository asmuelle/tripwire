import type { TokenUsage, TriggerProfile } from '@tripwire/core';
import { estimateTokens } from '@tripwire/core';

/**
 * Model integration boundary. The nightly pipeline only ever sees these interfaces;
 * the real Anthropic Batches clients (invariant 9: batch-only in scheduled runs)
 * land behind them in M2. Everything below the interfaces is a deterministic mock —
 * the whole test suite runs green with no API key and no network.
 */

export interface TriageRequest {
  readonly deltaId: string;
  readonly deltaText: string;
  readonly icpProfileText: string;
  readonly profiles: readonly TriggerProfile[];
}

export interface TriageScore {
  readonly deltaId: string;
  /** Best-matching trigger profile, if any cleared the model's own floor. */
  readonly profileId: string | undefined;
  readonly rawScore: number;
  readonly usage: TokenUsage;
}

export interface TriageClient {
  /** One batched call per account per night (Haiku-class work). */
  scoreDeltas(batch: readonly TriageRequest[]): Promise<readonly TriageScore[]>;
}

export interface SynthesisRequest {
  readonly deltaId: string;
  readonly accountName: string;
  readonly deltaText: string;
  readonly profileName: string;
  /** True on the single "quote verbatim" repair retry (DESIGN.md trust gate). */
  readonly repair: boolean;
}

export interface SynthesisDraft {
  readonly deltaId: string;
  readonly dossierSectionMd: string;
  readonly pinnedQuote: string;
  readonly suggestedAngle: string;
  readonly usage: TokenUsage;
}

export interface SynthesisClient {
  /** Sonnet-class batched dossier update + alert draft. */
  synthesize(batch: readonly SynthesisRequest[]): Promise<readonly SynthesisDraft[]>;
}

const usageFor = (input: string, output: string): TokenUsage => ({
  inputTokens: estimateTokens(input),
  outputTokens: estimateTokens(output),
});

const MOCK_MATCH_SCORE = 0.9;

const profileMatches = (profile: TriggerProfile, deltaText: string): boolean => {
  const haystack = deltaText.toLowerCase();
  return profile.examples.some((example) => haystack.includes(example.toLowerCase()));
};

/**
 * Deterministic triage mock: a profile "matches" when one of its example phrases
 * appears in the delta text. Stands in for Haiku batch + cached ICP prompt.
 */
export const createMockTriageClient = (): TriageClient => ({
  scoreDeltas: (batch) =>
    Promise.resolve(
      batch.map((request) => {
        const matched = request.profiles.find((profile) =>
          profileMatches(profile, request.deltaText),
        );
        return {
          deltaId: request.deltaId,
          profileId: matched?.id,
          rawScore: matched === undefined ? 0.05 : MOCK_MATCH_SCORE,
          usage: usageFor(request.icpProfileText + request.deltaText, 'score'),
        };
      }),
    ),
});

/** Longest sentence of the delta — a verbatim span, so the quote gate accepts it. */
export const longestSentence = (text: string): string => {
  const sentences = text
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.trim())
    .filter((sentence) => sentence.length > 0);
  return sentences.reduce(
    (best, candidate) => (candidate.length > best.length ? candidate : best),
    '',
  );
};

const draftFor = (request: SynthesisRequest, pinnedQuote: string): SynthesisDraft => {
  const section =
    `### ${request.profileName}\n\n` +
    `${request.accountName}: ${request.deltaText}\n\n` +
    `> ${pinnedQuote}`;
  const angle = `Open with the ${request.profileName.toLowerCase()} signal at ${request.accountName}.`;
  return {
    deltaId: request.deltaId,
    dossierSectionMd: section,
    pinnedQuote,
    suggestedAngle: angle,
    usage: usageFor(request.deltaText, section),
  };
};

/** Honest synthesis mock: pins a verbatim span from the delta text. */
export const createMockSynthesisClient = (): SynthesisClient => ({
  synthesize: (batch) =>
    Promise.resolve(batch.map((request) => draftFor(request, longestSentence(request.deltaText)))),
});

const paraphrase = (quote: string): string =>
  `According to the company, ${quote.toLowerCase().replace(/\.$/, '')} going forward.`;

/**
 * Adversarial mock for the M1 acceptance test (c): always paraphrases the quote,
 * including on the repair retry — the quote gate must block it, twice.
 */
export const createMisquotingSynthesisClient = (): SynthesisClient => ({
  synthesize: (batch) =>
    Promise.resolve(
      batch.map((request) => draftFor(request, paraphrase(longestSentence(request.deltaText)))),
    ),
});

/**
 * Repairable mock: paraphrases on the first attempt, returns the verbatim span when
 * the pipeline retries with the "quote verbatim" repair prompt (DESIGN.md trust gate).
 */
export const createRepairableSynthesisClient = (): SynthesisClient => ({
  synthesize: (batch) =>
    Promise.resolve(
      batch.map((request) => {
        const verbatim = longestSentence(request.deltaText);
        return draftFor(request, request.repair ? verbatim : paraphrase(verbatim));
      }),
    ),
});
