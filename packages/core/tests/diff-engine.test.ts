import { describe, expect, test } from 'vitest';

import { diffSnapshots } from '../src/diff.js';
import { buildSections, snapshotFromSections } from '../src/hash.js';

const snapshotOf = (items: readonly { key: string; text: string }[]) =>
  snapshotFromSections(buildSections(items));

const PRESS_ITEMS = [
  { key: 'p1', text: 'Norvane ships route optimization v2 for mid-market fleets.' },
  { key: 'p2', text: 'Norvane named a 2026 LogisticsTech Rising Vendor.' },
  { key: 'p3', text: 'Norvane to exhibit at FreightWorld Chicago, June 18-20.' },
];

describe('hash-diff engine — product invariant 3 (diff before LLM)', () => {
  test('identical content produces an identical content hash and zero deltas', () => {
    // Arrange
    const prev = snapshotOf(PRESS_ITEMS);
    const curr = snapshotOf(PRESS_ITEMS);

    // Act / Assert
    expect(curr.contentHash).toBe(prev.contentHash);
    expect(diffSnapshots(prev, curr)).toEqual([]);
  });

  test('reordered sections do NOT register as a change (COGS leak guard)', () => {
    // Arrange
    const prev = snapshotOf(PRESS_ITEMS);
    const curr = snapshotOf([PRESS_ITEMS[2]!, PRESS_ITEMS[0]!, PRESS_ITEMS[1]!]);

    // Act / Assert
    expect(curr.contentHash).toBe(prev.contentHash);
    expect(diffSnapshots(prev, curr)).toEqual([]);
  });

  test('tracking params on embedded URLs do NOT register as a change', () => {
    // Arrange
    const prev = snapshotOf([
      { key: 'p1', text: 'Read more at https://norvane.example/press/v2?id=7' },
    ]);
    const curr = snapshotOf([
      {
        key: 'p1',
        text: 'Read more at https://norvane.example/press/v2?id=7&utm_source=rss&utm_medium=feed&gclid=abc',
      },
    ]);

    // Act / Assert
    expect(curr.contentHash).toBe(prev.contentHash);
    expect(diffSnapshots(prev, curr)).toEqual([]);
  });

  test('smart-quote and whitespace churn does NOT register as a change', () => {
    // Arrange
    const prev = snapshotOf([{ key: 'p1', text: `Norvane's "living dossier" - now live.` }]);
    const curr = snapshotOf([{ key: 'p1', text: 'Norvane’s “living dossier” —  now live.' }]);

    // Act / Assert
    expect(curr.contentHash).toBe(prev.contentHash);
  });

  test('a genuinely new section yields exactly one section_added delta', () => {
    // Arrange
    const prev = snapshotOf(PRESS_ITEMS);
    const funding = {
      key: 'p4',
      text: 'Norvane Systems raises $24M Series B led by Crestline Capital.',
    };
    const curr = snapshotOf([...PRESS_ITEMS, funding]);

    // Act
    const deltas = diffSnapshots(prev, curr);

    // Assert
    expect(deltas).toHaveLength(1);
    expect(deltas[0]).toMatchObject({ kind: 'section_added', sectionKey: 'p4' });
  });

  test('an edited section yields one section_changed delta (paired by key)', () => {
    // Arrange
    const prev = snapshotOf(PRESS_ITEMS);
    const edited = PRESS_ITEMS.map((item) =>
      item.key === 'p2' ? { ...item, text: 'Norvane named a 2026 LogisticsTech Leader.' } : item,
    );
    const curr = snapshotOf(edited);

    // Act
    const deltas = diffSnapshots(prev, curr);

    // Assert
    expect(deltas).toHaveLength(1);
    expect(deltas[0]).toMatchObject({ kind: 'section_changed', sectionKey: 'p2' });
  });

  test('a removed section yields one section_removed delta', () => {
    // Arrange
    const prev = snapshotOf(PRESS_ITEMS);
    const curr = snapshotOf(PRESS_ITEMS.slice(0, 2));

    // Act
    const deltas = diffSnapshots(prev, curr);

    // Assert
    expect(deltas).toEqual([
      expect.objectContaining({ kind: 'section_removed', sectionKey: 'p3' }),
    ]);
  });

  test('the very first snapshot is a baseline and yields zero deltas', () => {
    // Arrange
    const curr = snapshotOf(PRESS_ITEMS);

    // Act / Assert — onboarding must not alert-storm
    expect(diffSnapshots(undefined, curr)).toEqual([]);
  });
});
