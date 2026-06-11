import { AlertWire } from '../components/brief/AlertWire';
import { DossierLog } from '../components/brief/DossierLog';
import { MonitorMargin } from '../components/brief/MonitorMargin';
import { buildBrief } from '../lib/slice';

/**
 * Read-only account intelligence brief: the M1 slice (fixtures, mocked models,
 * deterministic gates) rendered in the wire-brief editorial direction. Static —
 * the pipeline runs once at build time, no Postgres, no API keys.
 */
export default async function BriefPage() {
  const brief = await buildBrief();
  const latest = brief.reports[brief.reports.length - 1];

  return (
    <div className="brief">
      <header className="masthead">
        <div className="masthead-dateline">
          <span>Tripwire · nightly account radar</span>
          <span>{brief.teamName}</span>
          <span>run {latest?.runDate}</span>
        </div>
        <h1>
          <span className="tripwire-mark">Account Intelligence Brief</span>
        </h1>
        <div className="masthead-dateline">
          <span>
            {latest?.accountsMonitored} accounts monitored · {latest?.fetches} fetches ·{' '}
            {brief.alerts.length} triggers fired this week
          </span>
          <span>every quote string-verified · every claim cited</span>
        </div>
      </header>

      <div className="brief-grid">
        <main>
          <AlertWire alerts={brief.alerts} events={brief.events} />
          <DossierLog
            dossiers={brief.dossiers}
            accounts={brief.accounts}
            blockedExample={brief.blockedExample}
          />
        </main>
        <MonitorMargin
          accounts={brief.accounts}
          reports={brief.reports}
          lastCheckedAt={brief.lastCheckedAt}
          ledgerEntries={brief.ledgerEntries}
          ledgerTotals={brief.ledgerTotals}
        />
      </div>

      <footer className="brief-footer">
        <span>Tripwire M1 slice · fixtures + deterministic model mocks · no live calls</span>
        <span>
          llm spend this window: ${brief.ledgerTotals.llm.toFixed(6)} · unchanged nights cost
          $0.000000
        </span>
      </footer>
    </div>
  );
}
