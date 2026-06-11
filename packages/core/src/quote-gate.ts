import { normalizeText } from './normalize.js';

/**
 * Product invariant 1: no alert without a verified quote. This gate is plain code —
 * never an LLM judgment. Both the candidate quote and the stored snapshot text run
 * through the same deterministic normalization, then we require a strict substring
 * match (case-sensitive: a reworded quote must fail).
 */

export const MIN_QUOTE_LENGTH = 20;

export type QuoteVerification =
  | { readonly verified: true; readonly normalizedQuote: string }
  | {
      readonly verified: false;
      readonly reason: 'quote_too_short' | 'quote_not_found_in_snapshot';
    };

export const verifyQuote = (
  pinnedQuote: string,
  snapshotNormalizedText: string,
): QuoteVerification => {
  const quote = normalizeText(pinnedQuote);
  if (quote.length < MIN_QUOTE_LENGTH) {
    return { verified: false, reason: 'quote_too_short' };
  }
  const haystack = normalizeText(snapshotNormalizedText);
  if (!haystack.includes(quote)) {
    return { verified: false, reason: 'quote_not_found_in_snapshot' };
  }
  return { verified: true, normalizedQuote: quote };
};
