import { z } from 'zod';

/**
 * Boundary parsers: raw fetched documents (RSS XML, Greenhouse JSON) become keyed
 * text units for the hash-diff engine. External data is validated here, before it
 * touches domain logic (AGENTS.md coding standards).
 */

export interface ParsedItem {
  readonly key: string;
  readonly text: string;
  readonly url: string;
}

const NAMED_ENTITIES: Readonly<Record<string, string>> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
};

/** Decode numeric (&#8211; / &#x2013;) and common named HTML entities. */
export const decodeEntities = (input: string): string =>
  input
    .replace(/&#x([0-9a-f]+);/gi, (_, hex: string) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec: string) => String.fromCodePoint(Number(dec)))
    .replace(/&([a-z]+);/gi, (match, name: string) => NAMED_ENTITIES[name.toLowerCase()] ?? match);

export const stripTags = (html: string): string => html.replace(/<[^>]*>/g, ' ');

const tagContent = (block: string, tag: string): string | undefined => {
  const match = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, 'i').exec(block);
  return match?.[1]?.trim();
};

export class ParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ParseError';
  }
}

/**
 * Parse an RSS 2.0 feed into keyed items. Keys are the feed's stable <guid> values,
 * so a feed that merely reorders items hashes identically (COGS firewall).
 */
export const parseNewsroomRss = (xml: string): readonly ParsedItem[] => {
  if (!/<rss[\s>]/i.test(xml)) {
    throw new ParseError('not an RSS document: missing <rss> root');
  }
  const items = [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)].map((match, index) => {
    const block = match[1] ?? '';
    const guid = tagContent(block, 'guid');
    const title = tagContent(block, 'title');
    const description = tagContent(block, 'description');
    const link = tagContent(block, 'link');
    if (guid === undefined || title === undefined) {
      throw new ParseError(`RSS item ${index} is missing <guid> or <title>`);
    }
    const text = decodeEntities(`${title}. ${description ?? ''}`).trim();
    return { key: guid, text, url: decodeEntities(link ?? '') };
  });
  return items;
};

const greenhouseJobSchema = z.object({
  id: z.number(),
  title: z.string().min(1),
  updated_at: z.string(),
  location: z.object({ name: z.string() }),
  absolute_url: z.string().url(),
  content: z.string(),
});

const greenhouseBoardSchema = z.object({
  jobs: z.array(greenhouseJobSchema),
});

/**
 * Parse a Greenhouse job-board payload (boards-api JSON, HTML-escaped content).
 * Keys are the numeric job ids — stable across re-fetches.
 */
export const parseGreenhouseJobs = (json: string): readonly ParsedItem[] => {
  let raw: unknown;
  try {
    raw = JSON.parse(json);
  } catch {
    throw new ParseError('Greenhouse payload is not valid JSON');
  }
  const result = greenhouseBoardSchema.safeParse(raw);
  if (!result.success) {
    throw new ParseError(
      `Greenhouse payload failed validation: ${result.error.issues[0]?.message}`,
    );
  }
  return result.data.jobs.map((job) => ({
    key: `gh-${job.id}`,
    text: `${job.title} (${job.location.name}). ${stripTags(decodeEntities(job.content))}`.trim(),
    url: job.absolute_url,
  }));
};
