/**
 * Checked-in fixture: the public Greenhouse job-board JSON for Norvane Systems
 * (boards-api.greenhouse.io/v1/boards/norvanesystems/jobs?content=true), shaped
 * like the real endpoint: HTML-escaped content, location object, absolute_url.
 */

const BASELINE_JOBS = [
  {
    id: 7011001,
    internal_job_id: 5400101,
    title: 'Senior Backend Engineer, Dispatch Platform',
    updated_at: '2026-05-02T16:20:00-04:00',
    requisition_id: 'ENG-114',
    location: { name: 'Toronto, Ontario, Canada' },
    absolute_url: 'https://boards.greenhouse.io/norvanesystems/jobs/7011001',
    content:
      '&lt;p&gt;Norvane is hiring a senior backend engineer to scale the dispatch platform that plans 1.2 million stops per week.&lt;/p&gt;',
  },
  {
    id: 7011002,
    internal_job_id: 5400102,
    title: 'Field Sales Manager, Central Region',
    updated_at: '2026-04-18T10:05:00-04:00',
    requisition_id: 'SAL-031',
    location: { name: 'Chicago, Illinois, United States' },
    absolute_url: 'https://boards.greenhouse.io/norvanesystems/jobs/7011002',
    content:
      '&lt;p&gt;Own a territory of mid-market fleet operators across the Central US and carry a $1.4M quota.&lt;/p&gt;',
  },
  {
    id: 7011003,
    internal_job_id: 5400103,
    title: 'Customer Support Specialist',
    updated_at: '2026-03-29T09:00:00-04:00',
    requisition_id: 'CX-012',
    location: { name: 'Remote - Canada' },
    absolute_url: 'https://boards.greenhouse.io/norvanesystems/jobs/7011003',
    content: '&lt;p&gt;Front-line support for dispatchers using the Norvane console.&lt;/p&gt;',
  },
];

const REVOPS_JOB = {
  id: 7011004,
  internal_job_id: 5400104,
  title: 'Revenue Operations Lead',
  updated_at: '2026-06-09T08:45:00-04:00',
  requisition_id: 'GTM-001',
  location: { name: 'Toronto, Ontario, Canada (Hybrid)' },
  absolute_url: 'https://boards.greenhouse.io/norvanesystems/jobs/7011004',
  content:
    '&lt;p&gt;Norvane is hiring its first Revenue Operations Lead to own pipeline analytics, CRM hygiene, and sales process automation across a 14-rep go-to-market team.&lt;/p&gt;',
};

export const norvaneGreenhouseBaseline = JSON.stringify(
  { jobs: BASELINE_JOBS, meta: { total: BASELINE_JOBS.length } },
  null,
  2,
);

/** Baseline + first-RevOps-hire posting — the ATS-side trigger mutation. */
export const norvaneGreenhouseWithRevops = JSON.stringify(
  { jobs: [...BASELINE_JOBS, REVOPS_JOB], meta: { total: BASELINE_JOBS.length + 1 } },
  null,
  2,
);
