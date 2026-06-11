import { createHash } from 'node:crypto';

import { normalizeText } from './normalize.js';
import type { Section, SnapshotContent } from './types.js';

export const sha256Hex = (text: string): string =>
  createHash('sha256').update(text, 'utf8').digest('hex');

/** Build immutable, normalized, hashed sections from raw keyed text units. */
export const buildSections = (
  items: readonly { readonly key: string; readonly text: string }[],
): readonly Section[] =>
  items.map((item) => {
    const text = normalizeText(item.text);
    return { key: item.key, text, hash: sha256Hex(text) };
  });

/**
 * Order-insensitive content hash: reordering sections (e.g. an RSS feed shuffling
 * items) must NOT register as a change — that is where COGS leaks start.
 */
export const contentHashOf = (sectionHashes: readonly string[]): string =>
  sha256Hex([...sectionHashes].sort().join('\n'));

export const snapshotFromSections = (sections: readonly Section[]): SnapshotContent => ({
  sections,
  contentHash: contentHashOf(sections.map((section) => section.hash)),
  normalizedText: sections.map((section) => section.text).join('\n\n'),
});
