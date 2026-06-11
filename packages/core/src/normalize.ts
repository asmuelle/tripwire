/**
 * Deterministic text normalization shared by the hash-diff engine and the quote gate.
 * Both sides of every comparison run through the SAME function, so a quote that the
 * synthesis model copied verbatim always survives smart-quote / whitespace drift.
 */

const CHAR_REPLACEMENTS: ReadonlyArray<readonly [RegExp, string]> = [
  [/[‘’‚′]/g, "'"], // curly single quotes / prime
  [/[“”„″]/g, '"'], // curly double quotes / double prime
  [/[–—−]/g, '-'], // en/em dash, minus sign
  [/…/g, '...'], // ellipsis
  [/\u00A0/g, ' '], // non-breaking space
];

const URL_PATTERN = /https?:\/\/[^\s"'<>)\]]+/g;

const TRACKING_PARAM_PATTERN = /^(utm_[a-z0-9_]+|fbclid|gclid|mc_cid|mc_eid|igshid)$/i;

/** Drop tracking query params from a single URL; returns the input on parse failure. */
export const stripTrackingParams = (rawUrl: string): string => {
  try {
    const url = new URL(rawUrl);
    const kept = [...url.searchParams.entries()].filter(
      ([key]) => !TRACKING_PARAM_PATTERN.test(key),
    );
    url.search = '';
    for (const [key, value] of kept) {
      url.searchParams.append(key, value);
    }
    return url.toString();
  } catch {
    return rawUrl;
  }
};

/**
 * Canonical normalization: NFC, ASCII-fold typographic characters, strip URL tracking
 * params, collapse all whitespace runs to a single space, trim. Case is preserved —
 * the quote gate is deliberately strict about wording.
 */
export const normalizeText = (input: string): string => {
  const folded = CHAR_REPLACEMENTS.reduce(
    (text, [pattern, replacement]) => text.replace(pattern, replacement),
    input.normalize('NFC'),
  );
  const cleanedUrls = folded.replace(URL_PATTERN, (url) => stripTrackingParams(url));
  return cleanedUrls.replace(/\s+/g, ' ').trim();
};
