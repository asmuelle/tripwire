import type { Account, RegisteredSourceKey } from './types.js';

/**
 * Product invariant 2: entity resolution is deterministic. A delta attaches to an
 * account ONLY via a key registered at source creation (primary domain, EDGAR CIK,
 * or ATS board token). There is intentionally NO code path that accepts a company
 * name — fuzzy matching can never fire an alert.
 */

export type EntityResolution =
  | { readonly ok: true; readonly matchedKey: RegisteredSourceKey }
  | {
      readonly ok: false;
      readonly reason: 'source_not_registered_to_account' | 'registered_key_mismatch';
    };

/** Lowercase, strip scheme/www/path/port — "https://WWW.Norvane.example/press" → "norvane.example". */
export const canonicalDomain = (input: string): string => {
  const trimmed = input.trim().toLowerCase();
  const withoutScheme = trimmed.replace(/^[a-z][a-z0-9+.-]*:\/\//, '');
  const hostWithPort = withoutScheme.split('/')[0] ?? '';
  const host = hostWithPort.split(':')[0] ?? '';
  return host.startsWith('www.') ? host.slice(4) : host;
};

const stripLeadingZeros = (value: string): string => value.replace(/^0+(?=\d)/, '');

const keyMatchesAccount = (key: RegisteredSourceKey, account: Account): boolean => {
  switch (key.type) {
    case 'primary_domain':
      return canonicalDomain(key.value) === canonicalDomain(account.primaryDomain);
    case 'edgar_cik':
      return (
        account.edgarCik !== undefined &&
        stripLeadingZeros(key.value.trim()) === stripLeadingZeros(account.edgarCik.trim())
      );
    case 'ats_board_token':
      return (
        account.atsBoardToken !== undefined &&
        key.value.trim().toLowerCase() === account.atsBoardToken.trim().toLowerCase()
      );
  }
};

export const resolveEntity = (
  source: { readonly accountId: string; readonly registeredKey: RegisteredSourceKey },
  account: Account,
): EntityResolution => {
  if (source.accountId !== account.id) {
    return { ok: false, reason: 'source_not_registered_to_account' };
  }
  if (!keyMatchesAccount(source.registeredKey, account)) {
    return { ok: false, reason: 'registered_key_mismatch' };
  }
  return { ok: true, matchedKey: source.registeredKey };
};
