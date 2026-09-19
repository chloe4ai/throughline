import { useState } from 'react'
import type { QueueItem } from '../lib/api.js'

/**
 * The note and the claim, side by side. The point of the screen is that the
 * right-hand column is never typed by a human — it is derived from the minutes
 * on the left, which is the only way the two can't disagree.
 */
export function Documentation({ queue }: { queue: QueueItem[] }) {
  const [selected, setSelected] = useState(queue[0]?.visitId ?? '')
  const visit = queue.find((v) => v.visitId === selected) ?? queue[0]
  if (!visit) return <p className="muted">No documented visits.</p>

  return (
    <section className="split">
      <aside className="list">
        {queue.map((item) => (
          <button
            key={item.visitId}
            className={item.visitId === visit.visitId ? 'list-item active' : 'list-item'}
            onClick={() => setSelected(item.visitId)}
          >
            <strong>{item.patient}</strong>
            <span className="muted">{item.date} · {item.payer}</span>
            {!item.billable && <span className="pill blocker">held</span>}
          </button>
        ))}
      </aside>

      <div className="stack">
        <div className="panel">
          <h2>SOAP note</h2>
          {visit.note ? (
            <dl className="soap">
              <dt>Subjective</dt><dd>{visit.note.subjective}</dd>
              <dt>Objective</dt>
              <dd>
                <table className="grid">
                  <thead><tr><th>Code</th><th>Intervention</th><th className="num">Min</th><th className="num">PTA min</th></tr></thead>
                  <tbody>
                    {visit.note.objective.interventions.map((i, index) => (
                      <tr key={`${i.code}-${index}`}>
                        <td><code>{i.code}</code></td>
                        <td>{i.description}</td>
                        <td className="num">{i.minutes}</td>
                        <td className="num">{i.assistantMinutes ?? 0}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </dd>
              <dt>Assessment</dt><dd>{visit.note.assessment}</dd>
              <dt>Plan</dt><dd>{visit.note.plan}</dd>
              <dt>Signature</dt>
              <dd>{visit.note.signedBy ? `${visit.note.signedBy} · ${new Date(visit.note.signedAt!).toLocaleString()}` : <em className="warn-text">Unsigned</em>}</dd>
            </dl>
          ) : <p className="muted">No note on this visit.</p>}
        </div>

        <div className="panel">
          <h2>Derived claim</h2>
          <p className="muted">Generated from the minutes above under {visit.payer}'s rule ({visit.unitRule}).</p>
          <table className="grid">
            <thead><tr><th>Code</th><th className="num">Units</th><th>Modifier</th><th className="num">Allowed</th></tr></thead>
            <tbody>
              {visit.pricing.lines.map((line) => (
                <tr key={line.code}>
                  <td><code>{line.code}</code> <span className="muted">{line.description}</span></td>
                  <td className="num">{line.units}</td>
                  <td>{line.modifier ?? '—'}</td>
                  <td className="num">${line.allowed.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="panel">
          <h2>Compliance</h2>
          {visit.findings.length === 0 && <p className="ok-text">Clean. Nothing blocking this claim.</p>}
          <ul className="findings">
            {visit.findings.map((f) => (
              <li key={f.rule}>
                <span className={`pill ${f.severity}`}>{f.severity}</span>
                {f.message}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  )
}
