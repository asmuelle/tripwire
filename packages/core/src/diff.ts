import type { SectionDelta, SnapshotContent } from './types.js';

/**
 * Deterministic section diff — the COGS firewall (product invariant 3).
 *
 * - No previous snapshot ⇒ baseline run ⇒ NO deltas (onboarding must not alert-storm).
 * - Unchanged content hash ⇒ empty diff ⇒ the pipeline ends before any model call.
 * - Sections are paired by key, so a changed item is one 'section_changed' delta,
 *   not an add+remove pair.
 */
export const diffSnapshots = (
  prev: SnapshotContent | undefined,
  curr: SnapshotContent,
): readonly SectionDelta[] => {
  if (prev === undefined) {
    return [];
  }
  if (prev.contentHash === curr.contentHash) {
    return [];
  }

  const prevByKey = new Map(prev.sections.map((section) => [section.key, section]));
  const currByKey = new Map(curr.sections.map((section) => [section.key, section]));
  const deltas: SectionDelta[] = [];

  for (const section of curr.sections) {
    const before = prevByKey.get(section.key);
    if (before === undefined) {
      deltas.push({
        kind: 'section_added',
        sectionKey: section.key,
        text: section.text,
        currHash: section.hash,
      });
    } else if (before.hash !== section.hash) {
      deltas.push({
        kind: 'section_changed',
        sectionKey: section.key,
        text: section.text,
        prevHash: before.hash,
        currHash: section.hash,
      });
    }
  }

  for (const section of prev.sections) {
    if (!currByKey.has(section.key)) {
      deltas.push({
        kind: 'section_removed',
        sectionKey: section.key,
        text: section.text,
        prevHash: section.hash,
      });
    }
  }

  return deltas;
};
