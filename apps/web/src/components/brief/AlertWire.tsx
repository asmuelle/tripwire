import type { AlertPayload, TriggerEventRecord } from '@tripwire/pipeline';

import { formatStamp, sourceSlug } from '../../lib/slice';

interface AlertWireProps {
  readonly alerts: readonly AlertPayload[];
  readonly events: readonly TriggerEventRecord[];
}

/**
 * Delivered alerts as wire-service excerpts: red trigger chip (the only red on
 * the page), serif pull-quote with hairline left rule, mono source line, and the
 * three feedback verdicts every alert surface must carry (invariant 6).
 */
export function AlertWire({ alerts, events }: AlertWireProps) {
  const eventById = new Map(events.map((event) => [event.id, event]));
  return (
    <section aria-labelledby="wire-heading">
      <h2 id="wire-heading">Fired triggers</h2>
      {alerts.map((alert) => {
        const event = eventById.get(alert.triggerEventId);
        return (
          <article className="alert" key={alert.triggerEventId}>
            <span className="trigger-chip">{alert.profileName}</span>
            <h3>{alert.accountName}</h3>
            <blockquote className="pinned-quote" cite={alert.sourceUrl}>
              <p>“{alert.pinnedQuote}”</p>
              <footer className="source-line">
                {sourceSlug(alert.sourceUrl)}
                {event !== undefined && (
                  <>
                    {' · fetched '}
                    {formatStamp(event.sourceFetchedAt)}
                    {' · quote verified '}
                    {formatStamp(event.quoteVerifiedAt)}
                  </>
                )}
              </footer>
            </blockquote>
            <p className="angle">
              <strong>Suggested angle</strong> — {alert.suggestedAngle}
            </p>
            <div className="verdicts" aria-label="Rep feedback verdicts (read-only preview)">
              <span className="verdict">Useful</span>
              <span className="verdict">Not useful</span>
              <span className="verdict">Converted</span>
            </div>
          </article>
        );
      })}
    </section>
  );
}
