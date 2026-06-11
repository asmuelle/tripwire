import type { Account, Team, TriggerProfile } from '@tripwire/core';

import {
  norvaneGreenhouseBaseline,
  norvaneGreenhouseWithRevops,
} from '../fixtures/norvane-greenhouse.js';
import {
  norvaneNewsroomBaseline,
  norvaneNewsroomWithCfoChange,
  norvaneNewsroomWithFunding,
} from '../fixtures/norvane-newsroom.js';
import { QUIET_COMPANIES, quietNewsroomRss } from '../fixtures/quiet-newsrooms.js';
import type { SourceDef } from './store.js';

/**
 * M1 seed: one team, 10 fixture accounts (Norvane Systems plus nine quiet private
 * companies), two source kinds (newsroom RSS + Greenhouse ATS), three trigger
 * profiles. No HubSpot yet — accounts come from fixtures, per DESIGN.md M1.
 */

export const demoTeam: Team = {
  id: 'team_demo',
  name: 'Meridian Logistics Software — GTM',
  icpProfileText:
    'We sell dispatch-analytics software to mid-market logistics and field-service ' +
    'companies (50-500 vehicles). Strong buying signals: new funding rounds, first ' +
    'RevOps or sales-operations hires, fleet-expansion announcements.',
  alertThreshold: 0.6,
  peopleDataLicensed: false,
};

export const NORVANE_ACCOUNT_ID = 'acc_norvane';

const quietAccounts: readonly Account[] = QUIET_COMPANIES.map((company, index) => ({
  id: `acc_quiet_${index + 1}`,
  teamId: demoTeam.id,
  name: company.name,
  primaryDomain: company.domain,
  status: 'active',
  monthlyBudgetUsd: 0.5,
}));

export const demoAccounts: readonly Account[] = [
  {
    id: NORVANE_ACCOUNT_ID,
    teamId: demoTeam.id,
    name: 'Norvane Systems',
    primaryDomain: 'norvane.example',
    atsBoardToken: 'norvanesystems',
    status: 'active',
    monthlyBudgetUsd: 0.5,
  },
  ...quietAccounts,
];

export const NORVANE_NEWSROOM_SOURCE_ID = 'src_norvane_newsroom';
export const NORVANE_GREENHOUSE_SOURCE_ID = 'src_norvane_greenhouse';

const quietSources: readonly SourceDef[] = QUIET_COMPANIES.map((company, index) => ({
  id: `src_quiet_${index + 1}`,
  accountId: `acc_quiet_${index + 1}`,
  kind: 'newsroom_rss',
  url: `https://${company.domain}/news/rss.xml`,
  registeredKey: { type: 'primary_domain', value: company.domain },
}));

export const demoSources: readonly SourceDef[] = [
  {
    id: NORVANE_NEWSROOM_SOURCE_ID,
    accountId: NORVANE_ACCOUNT_ID,
    kind: 'newsroom_rss',
    url: 'https://norvane.example/press/rss.xml',
    registeredKey: { type: 'primary_domain', value: 'norvane.example' },
  },
  {
    id: NORVANE_GREENHOUSE_SOURCE_ID,
    accountId: NORVANE_ACCOUNT_ID,
    kind: 'ats_greenhouse',
    url: 'https://boards-api.greenhouse.io/v1/boards/norvanesystems/jobs?content=true',
    registeredKey: { type: 'ats_board_token', value: 'norvanesystems' },
  },
  ...quietSources,
];

export const PROFILE_FUNDING_ID = 'prof_funding';
export const PROFILE_REVOPS_ID = 'prof_revops';
export const PROFILE_EXEC_CHANGE_ID = 'prof_exec_change';

export const demoProfiles: readonly TriggerProfile[] = [
  {
    id: PROFILE_FUNDING_ID,
    teamId: demoTeam.id,
    name: 'Raised a funding round',
    description: 'Company announced new venture funding (seed through growth).',
    examples: ['raised a $', 'Series A', 'Series B', 'funding round'],
    weight: 1,
    requiresPeopleData: false,
    enabled: true,
  },
  {
    id: PROFILE_REVOPS_ID,
    teamId: demoTeam.id,
    name: 'Hiring first RevOps lead',
    description: 'First revenue-operations or sales-operations hire posted to the ATS.',
    examples: ['Revenue Operations Lead', 'RevOps', 'Sales Operations Manager'],
    weight: 1,
    requiresPeopleData: false,
    enabled: true,
  },
  {
    // Invariant 4: stays inert unless team.peopleDataLicensed is true.
    id: PROFILE_EXEC_CHANGE_ID,
    teamId: demoTeam.id,
    name: 'Executive change (CFO/CRO)',
    description: 'New finance or revenue executive appointed.',
    examples: ['Chief Financial Officer', 'Chief Revenue Officer'],
    weight: 1,
    requiresPeopleData: true,
    enabled: true,
  },
];

const quietDocuments = (): ReadonlyArray<readonly [string, string]> =>
  QUIET_COMPANIES.map((company, index) => [`src_quiet_${index + 1}`, quietNewsroomRss(company)]);

/** Night 0: every source at its baseline state. */
export const baselineDocuments = (): ReadonlyMap<string, string> =>
  new Map([
    [NORVANE_NEWSROOM_SOURCE_ID, norvaneNewsroomBaseline],
    [NORVANE_GREENHOUSE_SOURCE_ID, norvaneGreenhouseBaseline],
    ...quietDocuments(),
  ]);

/** Night 1 (M1 acceptance a): newsroom gains the Series B item; ATS unchanged. */
export const fundingNightDocuments = (): ReadonlyMap<string, string> =>
  new Map([
    [NORVANE_NEWSROOM_SOURCE_ID, norvaneNewsroomWithFunding],
    [NORVANE_GREENHOUSE_SOURCE_ID, norvaneGreenhouseBaseline],
    ...quietDocuments(),
  ]);

/** ATS-side mutation: the first-RevOps-hire posting appears. */
export const revopsNightDocuments = (): ReadonlyMap<string, string> =>
  new Map([
    [NORVANE_NEWSROOM_SOURCE_ID, norvaneNewsroomBaseline],
    [NORVANE_GREENHOUSE_SOURCE_ID, norvaneGreenhouseWithRevops],
    ...quietDocuments(),
  ]);

/** Exec-change mutation (invariant 4 test): CFO appointment hits the newsroom. */
export const cfoNightDocuments = (): ReadonlyMap<string, string> =>
  new Map([
    [NORVANE_NEWSROOM_SOURCE_ID, norvaneNewsroomWithCfoChange],
    [NORVANE_GREENHOUSE_SOURCE_ID, norvaneGreenhouseBaseline],
    ...quietDocuments(),
  ]);
