import type { QueueItem, AdherenceRow } from '../lib/api.js'
import { money } from '../lib/api.js'

export function Dashboard({
  queue, adherence, onJump,
}: {
  queue: QueueItem[]
  adherence: AdherenceRow[]
  onJump: (tab: 'Documentation' | 'Billing' | 'Adherence') => void
}) {
  const held = queue.filter((v) => !v.billable)
  const heldDollars = held.reduce((sum, v) => sum + v.pricing.netAllowed, 0)
  const reductions = queue.reduce((sum, v) => sum + v.pricing.reductionTotal, 0)
  const atRisk = adherence.filter((a) => a.summary.risk === 'at-risk' || a.summary.risk === 'disengaged')

  return (
    <section className="stack">
      <div className="tiles">
        <Tile label="Claims held" value={String(held.length)} caption={`${money(heldDollars)} not yet billable`} tone={held.length ? 'warn' : 'ok'} />
        <Tile label="Reductions this week" value={money(reductions)} caption="MPPR and assistant modifiers" />
        <Tile label="Patients off program" value={String(atRisk.length)} caption={`of ${adherence.length} with a home program`} tone={atRisk.length ? 'warn' : 'ok'} />
        <Tile label="Units documented" value={String(queue.reduce((s, v) => s + v.pricing.totalUnits, 0))} caption="across visits in the queue" />
      </div>

      <div className="panel">
        <div className="panel-head">
          <h2>Needs a human today</h2>
          <button className="link" onClick={() => onJump('Billing')}>Open billing queue</button>
        </div>
        {held.length === 0 && <p className="muted">Nothing held. Every documented visit is clean.</p>}
        <ul className="worklist">
          {held.map((visit) => (
            <li key={visit.visitId}>
              <div>
                <strong>{visit.patient}</strong>
                <span className="muted"> · {visit.date} · {visit.payer}</span>
              </div>
              <ul className="findings">
                {visit.findings.filter((f) => f.severity === 'blocker').map((f) => (
                  <li key={f.rule}><span className="pill blocker">blocker</span>{f.message}</li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      </div>

      <div className="panel">
        <div className="panel-head">
          <h2>Patients drifting off their program</h2>
          <button className="link" onClick={() => onJump('Adherence')}>Open adherence</button>
        </div>
        <ul className="worklist">
          {atRisk.map((row) => (
            <li key={row.programId}>
              <div><strong>{row.patient}</strong> <span className={`pill ${row.summary.risk}`}>{row.summary.risk}</span></div>
              <p className="muted">{row.summary.recommendation}</p>
            </li>
          ))}
          {atRisk.length === 0 && <li className="muted">Everyone is on program.</li>}
        </ul>
      </div>
    </section>
  )
}

function Tile({ label, value, caption, tone }: { label: string; value: string; caption: string; tone?: 'ok' | 'warn' }) {
  return (
    <div className={`tile ${tone ?? ''}`}>
      <p className="tile-label">{label}</p>
      <p className="tile-value">{value}</p>
      <p className="tile-caption">{caption}</p>
    </div>
  )
}
