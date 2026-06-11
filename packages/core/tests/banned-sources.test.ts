import { describe, expect, test } from 'vitest';

import { isBannedSourceHost } from '../src/banned-sources.js';

describe('isBannedSourceHost — product invariant 4 (never scrape LinkedIn/Indeed)', () => {
  test('bans linkedin.com and all subdomains', () => {
    expect(isBannedSourceHost('https://www.linkedin.com/company/norvane')).toBe(true);
    expect(isBannedSourceHost('https://de.linkedin.com/jobs/x')).toBe(true);
  });

  test('bans indeed.com and all subdomains', () => {
    expect(isBannedSourceHost('https://indeed.com/cmp/norvane')).toBe(true);
    expect(isBannedSourceHost('https://uk.indeed.com/viewjob?jk=1')).toBe(true);
  });

  test('does not ban lookalike or legitimate hosts', () => {
    expect(isBannedSourceHost('https://notlinkedin.com/x')).toBe(false);
    expect(isBannedSourceHost('https://norvane.example/press.rss')).toBe(false);
    expect(isBannedSourceHost('https://boards-api.greenhouse.io/v1/boards/norvane/jobs')).toBe(
      false,
    );
  });
});
