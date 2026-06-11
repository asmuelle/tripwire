import { canonicalDomain } from './entity-gate.js';

/**
 * Product invariant 4 (hard line): NEVER scrape LinkedIn or Indeed — ToS-locked
 * sources are out, period, regardless of feature pressure. Enforced at source
 * registration AND inside every fetcher (defense in depth).
 */
export const BANNED_SOURCE_HOSTS: readonly string[] = ['linkedin.com', 'indeed.com'];

export const isBannedSourceHost = (urlOrHost: string): boolean => {
  const host = canonicalDomain(urlOrHost);
  return BANNED_SOURCE_HOSTS.some((banned) => host === banned || host.endsWith(`.${banned}`));
};
