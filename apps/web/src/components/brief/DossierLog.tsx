import type { Account } from '@tripwire/core';
import type { DeltaRecord, DossierVersionRecord } from '@tripwire/pipeline';

import { formatStamp } from '../../lib/slice';

interface DossierLogProps {
  readonly dossiers: readonly DossierVersionRecord[];
  readonly accounts: readonly Account[];
  readonly blockedExample: DeltaRecord | undefined;
}

/**
 * Append-only dossier versions with their citation chips (invariant 7), plus the
 * internal review queue: a gate-blocked draft the reps were protected from.
 */
export function DossierLog({ dossiers, accounts, blockedExample }: DossierLogProps) {
  const nameById = new Map(accounts.map((account) => [account.id, account.name]));
  return (
    <>
      <section aria-labelledby="dossier-heading">
        <h2 id="dossier-heading">Dossier — appended this week</h2>
        {dossiers.map((version) => (
          <article className="dossier-version" key={version.id}>
            <span className="kicker">
              {nameById.get(version.accountId)} · v{version.versionNo} ·{' '}
              {formatStamp(version.createdAt)}
            </span>
            <pre>{version.bodyMd}</pre>
            {version.citations.map((citation) => (
              <span className="citation-chip" key={citation}>
                cite:{citation}
              </span>
            ))}
          </article>
        ))}
      </section>

      <section aria-labelledby="gate-heading">
        <h2 id="gate-heading">Gate queue — blocked before delivery</h2>
        {blockedExample === undefined ? (
          <p>No drafts were blocked in this window.</p>
        ) : (
          <div className="gate-blocked">
            <p className="reason">blocked · {blockedExample.gateBlockReason}</p>
            <p>
              A synthesis draft for this delta paraphrased its quote. The deterministic quote gate
              rejected it twice (attempt + verbatim-repair retry); no rep ever saw it.
            </p>
            <p className="source-line">
              delta {blockedExample.id} · {blockedExample.delta.sectionKey}
            </p>
          </div>
        )}
      </section>
    </>
  );
}
