import { describe, expect, test } from 'vitest';

import { normalizeText, stripTrackingParams } from '../src/normalize.js';

describe('normalizeText', () => {
  test('folds smart quotes, dashes, ellipsis, and NBSP to ASCII equivalents', () => {
    expect(normalizeText('“Hello” — it’s… here now')).toBe(`"Hello" - it's... here now`);
  });

  test('collapses all whitespace runs and trims', () => {
    expect(normalizeText('  a\t\tb\n\nc  ')).toBe('a b c');
  });

  test('applies Unicode NFC so composed and decomposed accents hash identically', () => {
    expect(normalizeText('Café')).toBe(normalizeText('Café'));
  });

  test('is idempotent', () => {
    const once = normalizeText('“Mixed”…  input — here');
    expect(normalizeText(once)).toBe(once);
  });
});

describe('stripTrackingParams', () => {
  test('removes utm_*, gclid, and fbclid but keeps meaningful params', () => {
    expect(
      stripTrackingParams('https://x.example/a?id=7&utm_source=rss&gclid=g&fbclid=f&page=2'),
    ).toBe('https://x.example/a?id=7&page=2');
  });

  test('returns non-URL input unchanged', () => {
    expect(stripTrackingParams('not a url')).toBe('not a url');
  });
});
