/**
 * Checked-in fixture: the newsroom RSS feed of "Norvane Systems", a fictional
 * mid-market logistics-software company (primary domain norvane.example).
 * Stored verbatim as the documents a raw-HTTP fetcher would return.
 */

const BASELINE_ITEMS = `
    <item>
      <title>Norvane Ships Route Optimization v2 for Mid-Market Fleets</title>
      <link>https://norvane.example/press/route-optimization-v2?utm_source=rss&amp;utm_medium=feed</link>
      <guid isPermaLink="false">norvane-press-0041</guid>
      <pubDate>Tue, 12 May 2026 09:00:00 GMT</pubDate>
      <description>Norvane Systems released version 2 of its route optimization engine, cutting average planning time by 38 percent for fleets of 50 to 500 vehicles.</description>
    </item>
    <item>
      <title>Norvane Named a 2026 LogisticsTech Rising Vendor</title>
      <link>https://norvane.example/press/logisticstech-rising-vendor-2026</link>
      <guid isPermaLink="false">norvane-press-0040</guid>
      <pubDate>Thu, 23 Apr 2026 14:30:00 GMT</pubDate>
      <description>Industry analyst group FreightSignal placed Norvane on its 2026 Rising Vendor list for telematics-integrated planning software.</description>
    </item>
    <item>
      <title>Norvane to Exhibit at FreightWorld Chicago</title>
      <link>https://norvane.example/press/freightworld-chicago-2026</link>
      <guid isPermaLink="false">norvane-press-0039</guid>
      <pubDate>Mon, 30 Mar 2026 08:00:00 GMT</pubDate>
      <description>Meet the Norvane team at booth 214, June 18&#8211;20, for live demos of the dispatch console.</description>
    </item>`;

const FUNDING_ITEM = `
    <item>
      <title>Norvane Systems Raises $24M Series B Led by Crestline Capital</title>
      <link>https://norvane.example/press/series-b-announcement?utm_source=rss&amp;utm_campaign=funding</link>
      <guid isPermaLink="false">norvane-press-0042</guid>
      <pubDate>Tue, 09 Jun 2026 13:00:00 GMT</pubDate>
      <description>Norvane Systems today announced it has raised a $24 million Series B round led by Crestline Capital to expand its logistics intelligence platform into North American mid-market fleets. The round brings total funding to $36 million and will fund a doubling of the go-to-market team by Q4 2026.</description>
    </item>`;

const CFO_ITEM = `
    <item>
      <title>Norvane Systems Appoints Dana Whitfield as Chief Financial Officer</title>
      <link>https://norvane.example/press/cfo-announcement</link>
      <guid isPermaLink="false">norvane-press-0043</guid>
      <pubDate>Wed, 10 Jun 2026 07:00:00 GMT</pubDate>
      <description>Norvane Systems named Dana Whitfield as Chief Financial Officer, effective July 1, to lead the finance organization through its next phase of growth.</description>
    </item>`;

const wrap = (items: string): string => `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>Norvane Systems Newsroom</title>
    <link>https://norvane.example/press</link>
    <description>Press releases and company news from Norvane Systems.</description>${items}
  </channel>
</rss>
`;

export const norvaneNewsroomBaseline = wrap(BASELINE_ITEMS);

/** Baseline + one new funding item — the M1 acceptance mutation (exactly one delta). */
export const norvaneNewsroomWithFunding = wrap(`${FUNDING_ITEM}${BASELINE_ITEMS}`);

/** Baseline + an exec-change item — only alertable with a people-data license (invariant 4). */
export const norvaneNewsroomWithCfoChange = wrap(`${CFO_ITEM}${BASELINE_ITEMS}`);
