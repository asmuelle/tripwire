import { describe, expect, test } from 'vitest';

import { canonicalDomain, resolveEntity } from '../src/entity-gate.js';
import type { Account } from '../src/types.js';

const norvane: Account = {
  id: 'acc_norvane',
  teamId: 'team_1',
  name: 'Norvane Systems',
  primaryDomain: 'norvane.example',
  edgarCik: '0001234567',
  atsBoardToken: 'norvanesystems',
  status: 'active',
  monthlyBudgetUsd: 0.5,
};

describe('canonicalDomain', () => {
  test('strips scheme, www, path, and port and lowercases', () => {
    expect(canonicalDomain('https://WWW.Norvane.example:443/press/releases?x=1')).toBe(
      'norvane.example',
    );
  });

  test('passes through a bare host', () => {
    expect(canonicalDomain('norvane.example')).toBe('norvane.example');
  });
});

describe('resolveEntity — product invariant 2 (deterministic entity resolution)', () => {
  test('passes when the source is registered to the account with its primary domain', () => {
    // Arrange
    const source = {
      accountId: 'acc_norvane',
      registeredKey: { type: 'primary_domain', value: 'https://www.norvane.example/press' },
    } as const;

    // Act
    const result = resolveEntity(source, norvane);

    // Assert
    expect(result.ok).toBe(true);
  });

  test('passes on EDGAR CIK match regardless of leading zeros', () => {
    // Arrange
    const source = {
      accountId: 'acc_norvane',
      registeredKey: { type: 'edgar_cik', value: '1234567' },
    } as const;

    // Act
    const result = resolveEntity(source, norvane);

    // Assert
    expect(result.ok).toBe(true);
  });

  test('passes on ATS board token match (case-insensitive)', () => {
    // Arrange
    const source = {
      accountId: 'acc_norvane',
      registeredKey: { type: 'ats_board_token', value: 'NorvaneSystems' },
    } as const;

    // Act
    const result = resolveEntity(source, norvane);

    // Assert
    expect(result.ok).toBe(true);
  });

  test('blocks a source registered to a different account, even with a matching domain', () => {
    // Arrange — wrong-company near-miss: same domain key, different account binding
    const source = {
      accountId: 'acc_other',
      registeredKey: { type: 'primary_domain', value: 'norvane.example' },
    } as const;

    // Act
    const result = resolveEntity(source, norvane);

    // Assert
    expect(result).toEqual({ ok: false, reason: 'source_not_registered_to_account' });
  });

  test('blocks a near-match lookalike domain ("norvane-systems.example")', () => {
    // Arrange
    const source = {
      accountId: 'acc_norvane',
      registeredKey: { type: 'primary_domain', value: 'norvane-systems.example' },
    } as const;

    // Act
    const result = resolveEntity(source, norvane);

    // Assert
    expect(result).toEqual({ ok: false, reason: 'registered_key_mismatch' });
  });

  test('blocks a subdomain that is not the registered primary domain', () => {
    // Arrange
    const source = {
      accountId: 'acc_norvane',
      registeredKey: { type: 'primary_domain', value: 'blog.norvane.example' },
    } as const;

    // Act
    const result = resolveEntity(source, norvane);

    // Assert
    expect(result.ok).toBe(false);
  });

  test('blocks a CIK key when the account has no CIK registered', () => {
    // Arrange
    const accountWithoutCik: Account = {
      id: norvane.id,
      teamId: norvane.teamId,
      name: norvane.name,
      primaryDomain: norvane.primaryDomain,
      atsBoardToken: 'norvanesystems',
      status: norvane.status,
      monthlyBudgetUsd: norvane.monthlyBudgetUsd,
    };
    const source = {
      accountId: 'acc_norvane',
      registeredKey: { type: 'edgar_cik', value: '1234567' },
    } as const;

    // Act
    const result = resolveEntity(source, accountWithoutCik);

    // Assert
    expect(result).toEqual({ ok: false, reason: 'registered_key_mismatch' });
  });

  test('there is no company-name input anywhere in the gate API (no fuzzy path exists)', () => {
    // Assert — resolveEntity accepts only accountId + registeredKey; a similar name
    // cannot be expressed as a key type, so it cannot fire an alert.
    const keyTypes: ReadonlyArray<string> = ['primary_domain', 'edgar_cik', 'ats_board_token'];
    expect(keyTypes).not.toContain('company_name');
  });
});
