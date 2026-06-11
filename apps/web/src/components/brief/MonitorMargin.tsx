import type { Account, CostCategory, CostEntry } from '@tripwire/core';
import type { NightlyRunReport } from '@tripwire/pipeline';

import { formatStamp } from '../../lib/slice';

interface MonitorMarginProps {
  readonly accounts: readonly Account[];
  readonly reports: readonly NightlyRunReport[];
  readonly lastCheckedAt: Readonly<Record<string, string>>;
  readonly ledgerEntries: readonly CostEntry[];
  readonly ledgerTotals: Readonly<Record<CostCategory, number>>;
}

const CATEGORIES: readonly CostCategory[] = ['llm', 'search', 'scrape', 'people_data'];

/**
 * The monitoring margin: silence rendered as evidence (invariant 10) and the
 * cost ledger rendered as an auditable table (invariant 5).
 */
export function MonitorMargin({
  accounts,
  reports,
  lastCheckedAt,
  ledgerEntries,
  ledgerTotals,
}: MonitorMarginProps) {
  return (
    <aside className="margin-note" aria-label="Monitoring evidence">
      <section aria-labelledby="watch-heading">
        <h2 id="watch-heading">Watch list</h2>
        <table>
          <caption>10 named accounts · every row shows when it was last checked</caption>
          <thead>
            <tr>
              <th scope="col">Account</th>
              <th scope="col">Domain</th>
              <th scope="col">Last checked</th>
            </tr>
          </thead>
          <tbody>
            {accounts.map((account) => (
              <tr key={account.id}>
                <td>{account.name}</td>
                <td className="mono">{account.primaryDomain}</td>
                <td className="mono">
                  {lastCheckedAt[account.id] === undefined
                    ? 'paused'
                    : formatStamp(lastCheckedAt[account.id] ?? '')}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section aria-labelledby="runs-heading">
        <h2 id="runs-heading">Nightly runs</h2>
        <table>
          <caption>Diff before LLM: unchanged sources end the pipeline at $0</caption>
          <thead>
            <tr>
              <th scope="col">Run</th>
              <th scope="col">Fetches</th>
              <th scope="col">Deltas</th>
              <th scope="col">Alerts</th>
            </tr>
          </thead>
          <tbody>
            {reports.map((report) => (
              <tr key={report.runDate}>
                <td className="mono">{report.runDate}</td>
                <td className="num">{report.fetches}</td>
                <td className="num">{report.deltasDetected}</td>
                <td className="num">{report.alertsDelivered}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section aria-labelledby="ledger-heading">
        <h2 id="ledger-heading">Cost ledger</h2>
        <table>
          <caption>Every model call writes a row — none are missing</caption>
          <thead>
            <tr>
              <th scope="col">Date</th>
              <th scope="col">Call</th>
              <th scope="col">USD</th>
            </tr>
          </thead>
          <tbody>
            {ledgerEntries.map((entry, index) => (
              <tr key={`${entry.runDate}-${index}`}>
                <td className="mono">{entry.runDate}</td>
                <td className="mono">{entry.note}</td>
                <td className="num">{entry.usdCost.toFixed(6)}</td>
              </tr>
            ))}
            {CATEGORIES.map((category) => (
              <tr key={category}>
                <td />
                <td className="mono">total · {category}</td>
                <td className="num">{(ledgerTotals[category] ?? 0).toFixed(6)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </aside>
  );
}
