/**
 * Checked-in fixtures: small, evergreen newsroom feeds for the nine quiet seeded
 * accounts. They never change between runs — most private SMB accounts are silent
 * for months, and the pipeline must prove that silence costs $0.00 in LLM spend
 * (product invariants 3 and 10).
 */

export interface QuietCompany {
  readonly slug: string;
  readonly name: string;
  readonly domain: string;
  readonly headline: string;
  readonly note: string;
}

export const QUIET_COMPANIES: readonly QuietCompany[] = [
  {
    slug: 'harbinder-foods',
    name: 'Harbinder Foods',
    domain: 'harbinderfoods.example',
    headline: 'Harbinder Foods Opens Third Distribution Kitchen in Leeds',
    note: 'The new site adds 40,000 sq ft of chilled capacity for northern grocers.',
  },
  {
    slug: 'bluequarry',
    name: 'BlueQuarry Surfaces',
    domain: 'bluequarry.example',
    headline: 'BlueQuarry Publishes 2025 Sustainability Report',
    note: 'Recycled aggregate now makes up 22 percent of finished surface volume.',
  },
  {
    slug: 'pellangrid',
    name: 'Pellan Grid Services',
    domain: 'pellangrid.example',
    headline: 'Pellan Grid Completes Substation Retrofit Program',
    note: 'Fourteen substations upgraded across the Midlands ahead of schedule.',
  },
  {
    slug: 'mosswick',
    name: 'Mosswick Insurance Group',
    domain: 'mosswick.example',
    headline: 'Mosswick Renews Regional Broker Partnerships for 2026',
    note: 'Eleven broker agreements renewed across the Southeast.',
  },
  {
    slug: 'tarnfield',
    name: 'Tarnfield Labs',
    domain: 'tarnfield.example',
    headline: 'Tarnfield Labs Receives ISO 17025 Re-Accreditation',
    note: 'The materials-testing facility passed its five-year audit cycle.',
  },
  {
    slug: 'quillhaven',
    name: 'Quillhaven Press',
    domain: 'quillhaven.example',
    headline: 'Quillhaven Announces Autumn Catalogue',
    note: 'Forty-two new titles across trade and academic imprints.',
  },
  {
    slug: 'ferrowind',
    name: 'Ferrowind Marine',
    domain: 'ferrowind.example',
    headline: 'Ferrowind Marine Christens Survey Vessel "Petrel"',
    note: 'The Petrel begins North Sea seabed survey work in July.',
  },
  {
    slug: 'lanthornhr',
    name: 'Lanthorn HR',
    domain: 'lanthornhr.example',
    headline: 'Lanthorn HR Hosts Quarterly People-Ops Roundtable',
    note: 'Sixty practitioners attended the spring session in Manchester.',
  },
  {
    slug: 'gritstone-civil',
    name: 'Gritstone Civil',
    domain: 'gritstonecivil.example',
    headline: 'Gritstone Civil Marks 25 Years of Operations',
    note: 'The contractor celebrated its anniversary with long-service awards.',
  },
];

export const quietNewsroomRss = (
  company: QuietCompany,
): string => `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>${company.name} News</title>
    <link>https://${company.domain}/news</link>
    <description>Company announcements from ${company.name}.</description>
    <item>
      <title>${company.headline}</title>
      <link>https://${company.domain}/news/1</link>
      <guid isPermaLink="false">${company.slug}-news-0001</guid>
      <pubDate>Mon, 02 Feb 2026 09:00:00 GMT</pubDate>
      <description>${company.note}</description>
    </item>
    <item>
      <title>${company.name} Publishes Company Overview</title>
      <link>https://${company.domain}/news/about</link>
      <guid isPermaLink="false">${company.slug}-news-0000</guid>
      <pubDate>Mon, 05 Jan 2026 09:00:00 GMT</pubDate>
      <description>Background, leadership, and service areas for ${company.name}.</description>
    </item>
  </channel>
</rss>
`;
