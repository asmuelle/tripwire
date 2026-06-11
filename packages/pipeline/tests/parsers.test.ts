import { describe, expect, test } from 'vitest';

import { norvaneGreenhouseBaseline } from '../fixtures/norvane-greenhouse.js';
import { norvaneNewsroomBaseline } from '../fixtures/norvane-newsroom.js';
import {
  ParseError,
  decodeEntities,
  parseGreenhouseJobs,
  parseNewsroomRss,
} from '../src/parsers.js';

describe('parseNewsroomRss — boundary validation of feed XML', () => {
  test('parses the baseline feed into guid-keyed items with title and description text', () => {
    // Act
    const items = parseNewsroomRss(norvaneNewsroomBaseline);

    // Assert
    expect(items).toHaveLength(3);
    expect(items.map((item) => item.key)).toEqual([
      'norvane-press-0041',
      'norvane-press-0040',
      'norvane-press-0039',
    ]);
    expect(items[0]?.text).toContain('Route Optimization v2');
    expect(items[0]?.text).toContain('cutting average planning time by 38 percent');
  });

  test('decodes numeric and named HTML entities in item text', () => {
    // Arrange — the booth item carries &#8211; (en dash) in its description
    const items = parseNewsroomRss(norvaneNewsroomBaseline);

    // Act
    const booth = items.find((item) => item.key === 'norvane-press-0039');

    // Assert
    expect(booth?.text).toContain('June 18–20');
    expect(decodeEntities('A &amp; B &#x27;quoted&#x27;')).toBe("A & B 'quoted'");
  });

  test('throws ParseError on a document that is not RSS', () => {
    expect(() => parseNewsroomRss('<html><body>not a feed</body></html>')).toThrow(ParseError);
  });

  test('throws ParseError when an item is missing its stable guid key', () => {
    const feed =
      '<rss version="2.0"><channel><item><title>No guid here</title></item></channel></rss>';
    expect(() => parseNewsroomRss(feed)).toThrow(ParseError);
  });
});

describe('parseGreenhouseJobs — boundary validation of ATS JSON', () => {
  test('parses the baseline board into id-keyed items with tags stripped', () => {
    // Act
    const items = parseGreenhouseJobs(norvaneGreenhouseBaseline);

    // Assert
    expect(items).toHaveLength(3);
    expect(items.map((item) => item.key)).toEqual(['gh-7011001', 'gh-7011002', 'gh-7011003']);
    expect(items[0]?.text).toContain('Senior Backend Engineer, Dispatch Platform');
    expect(items[0]?.text).not.toContain('<p>');
    expect(items[0]?.text).toContain('1.2 million stops per week');
  });

  test('throws ParseError on invalid JSON', () => {
    expect(() => parseGreenhouseJobs('{ not json')).toThrow(ParseError);
  });

  test('throws ParseError when the payload fails schema validation', () => {
    expect(() => parseGreenhouseJobs(JSON.stringify({ jobs: [{ id: 'wrong' }] }))).toThrow(
      ParseError,
    );
  });
});
