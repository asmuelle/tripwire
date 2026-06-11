import { describe, expect, test } from 'vitest';

import { MIN_QUOTE_LENGTH, verifyQuote } from '../src/quote-gate.js';

const SNAPSHOT_TEXT =
  'Norvane Systems today announced it has raised a $24 million Series B round led by ' +
  'Crestline Capital to expand its logistics intelligence platform.';

describe('verifyQuote — product invariant 1 (no alert without a verified quote)', () => {
  test('accepts a verbatim quote copied from the snapshot', () => {
    // Arrange
    const quote = 'raised a $24 million Series B round led by Crestline Capital';

    // Act
    const result = verifyQuote(quote, SNAPSHOT_TEXT);

    // Assert
    expect(result.verified).toBe(true);
  });

  test('accepts a quote that differs only in smart quotes, dashes, and whitespace', () => {
    // Arrange — typographic variants the model or a CMS may introduce
    const snapshot = 'The CEO said: "We\'re doubling down on mid-market fleets - everywhere."';
    const quote = 'The CEO said: “We’re doubling down on mid-market fleets — everywhere.”';

    // Act
    const result = verifyQuote(quote, snapshot);

    // Assert
    expect(result.verified).toBe(true);
  });

  test('accepts a quote with collapsed vs expanded whitespace and NBSP', () => {
    // Arrange
    const quote = 'raised a $24 million Series B   round\n led by Crestline Capital';

    // Act
    const result = verifyQuote(quote, SNAPSHOT_TEXT);

    // Assert
    expect(result.verified).toBe(true);
  });

  test('rejects a paraphrased quote that swaps a single word', () => {
    // Arrange — "round" → "investment": meaning preserved, wording changed
    const quote = 'raised a $24 million Series B investment led by Crestline Capital';

    // Act
    const result = verifyQuote(quote, SNAPSHOT_TEXT);

    // Assert
    expect(result).toEqual({ verified: false, reason: 'quote_not_found_in_snapshot' });
  });

  test('rejects a quote whose casing was changed', () => {
    // Arrange
    const quote = 'Raised A $24 Million Series B Round led by Crestline Capital';

    // Act
    const result = verifyQuote(quote, SNAPSHOT_TEXT);

    // Assert
    expect(result.verified).toBe(false);
  });

  test('rejects a quote from a different document', () => {
    // Arrange
    const quote = 'Acme Robotics appoints a new Chief Financial Officer effective Monday';

    // Act
    const result = verifyQuote(quote, SNAPSHOT_TEXT);

    // Assert
    expect(result).toEqual({ verified: false, reason: 'quote_not_found_in_snapshot' });
  });

  test('rejects quotes shorter than the minimum length even if they match', () => {
    // Arrange
    const quote = 'Series B';
    expect(quote.length).toBeLessThan(MIN_QUOTE_LENGTH);

    // Act
    const result = verifyQuote(quote, SNAPSHOT_TEXT);

    // Assert
    expect(result).toEqual({ verified: false, reason: 'quote_too_short' });
  });

  test('rejects an empty quote', () => {
    // Act
    const result = verifyQuote('', SNAPSHOT_TEXT);

    // Assert
    expect(result).toEqual({ verified: false, reason: 'quote_too_short' });
  });

  test('rejects a truncation that splices two sentence fragments together', () => {
    // Arrange — both halves exist in the snapshot, but not adjacently
    const quote = 'Norvane Systems today announced logistics intelligence platform.';

    // Act
    const result = verifyQuote(quote, SNAPSHOT_TEXT);

    // Assert
    expect(result.verified).toBe(false);
  });
});
