import { useMemo, useState } from 'react'
import { priceVisit } from '@throughline/billing'
import type { Payer, ServiceLine } from '@throughline/domain'
import type { QueueItem } from '../lib/api.js'
import { money } from '../lib/api.js'

/**
 * The what-if tool. It runs the SAME engine the API runs — imported directly —
 * so a therapist can see, before the patient leaves, what three more minutes
 * of manual therapy is worth on this plan.
 */

const PAYERS: Payer[] = [
  { id: 'medicare', name: 'Medicare Part B', unitRule: 'medicare-8-minute', appliesMppr: true, appliesAssistantReduction: true, feeScheduleMultiplier: 1 },
  { id: 'bcbs', name: 'Blue Shield PPO', unitRule: 'ama-rule-of-eights', appliesMppr: false, appliesAssistantReduction: false, feeScheduleMultiplier: 1.35 },
  { id: 'united', name: 'UnitedHealthcare', unitRule: 'medicare-8-minute', appliesMppr: true, appliesAssistantReduction: true, feeScheduleMultiplier: 1.12 },
]

const CODES = [
  { code: '97110', label: 'Therapeutic exercise' },
  { code: '97140', label: 'Manual therapy' },
  { code: '97530', label: 'Therapeutic activities' },
  { code: '97112', label: 'Neuromuscular reeducation' },
]

export function Billing({ queue }: { queue: QueueItem[] }) {
  const [payerId, setPayerId] = useState(PAYERS[0]!.id)
  const [minutes, setMinutes] = useState<Record<string, number>>({ '97110': 20, '97140': 20, '97530': 0, '97112': 0 })
  const [assistantMinutes, setAssistantMinutes] = useState(0)

  const payer = PAYERS.find((p) => p.id === payerId)!
  const services: ServiceLine[] = useMemo(
    () =>
      CODES.filter(({ code }) => (minutes[code] ?? 0) > 0).map(({ code }, index) => ({
        code,
        minutes: minutes[code] ?? 0,
        assistantMinutes: index === 0 ? Math.min(assistantMinutes, minutes[code] ?? 0) : 0,
      })),
    [minutes, assistantMinutes],
  )

  const pricing = useMemo(
    () => priceVisit({ services, payer, benefits: { deductibleRemaining: 0, coinsurance: 0.2 }, discipline: 'PT' }),
    [services, payer],
  )

  const otherRule = PAYERS.find((p) => p.unitRule !== payer.unitRule)
  const underOtherRule = otherRule
    ? priceVisit({ services, payer: { ...otherRule, feeScheduleMultiplier: payer.feeScheduleMultiplier }, benefits: { deductibleRemaining: 0, coinsurance: 0.2 }, discipline: 'PT' })
    : null

  return (
    <section className="stack">
      <div className="panel">
        <h2>What is this visit worth?</h2>
        <div className="controls">
          <label>
            Plan
            <select value={payerId} onChange={(e) => setPayerId(e.target.value)}>
              {PAYERS.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </label>
          {CODES.map(({ code, label }) => (
            <label key={code}>
              <span><code>{code}</code> {label}</span>
              <input
                type="range" min={0} max={60} step={1}
                value={minutes[code] ?? 0}
                onChange={(e) => setMinutes((m) => ({ ...m, [code]: Number(e.target.value) }))}
              />
              <output>{minutes[code] ?? 0} min</output>
            </label>
          ))}
          <label>
            <span>Of which PTA-delivered (first code)</span>
            <input type="range" min={0} max={60} step={1} value={assistantMinutes} onChange={(e) => setAssistantMinutes(Number(e.target.value))} />
            <output>{assistantMinutes} min</output>
          </label>
        </div>

        <div className="result">
          <div className="result-figures">
            <Figure label="Timed minutes" value={String(pricing.totalTimedMinutes)} />
            <Figure label="Units" value={String(pricing.totalUnits)} />
            <Figure label="Allowed before reductions" value={money(pricing.grossAllowed)} />
            <Figure label="Paid" value={money(pricing.netAllowed)} emphasis />
          </div>
          {pricing.reductionTotal > 0 && (
            <p className="muted">Reductions take {money(pricing.reductionTotal)} off this visit.</p>
          )}
          {underOtherRule && underOtherRule.totalUnits !== pricing.totalUnits && (
            <p className="callout">
              The same minutes bill <strong>{underOtherRule.totalUnits} units</strong> under the{' '}
              {otherRule!.unitRule === 'medicare-8-minute' ? 'Medicare 8-minute rule' : 'AMA rule of eights'} —
              a {money(Math.abs(underOtherRule.netAllowed - pricing.netAllowed))} difference on one visit.
            </p>
          )}
          {pricing.warnings.map((w) => <p key={w} className="warn-text">{w}</p>)}
        </div>

        <table className="grid">
          <thead><tr><th>Code</th><th className="num">Units</th><th>Modifier</th><th className="num">Full</th><th className="num">Paid</th><th>Why</th></tr></thead>
          <tbody>
            {pricing.lines.map((line) => (
              <tr key={line.code}>
                <td><code>{line.code}</code> <span className="muted">{line.description}</span></td>
                <td className="num">{line.units}</td>
                <td>{line.modifier ?? '—'}</td>
                <td className="num">${line.fullAllowed.toFixed(2)}</td>
                <td className="num">${line.allowed.toFixed(2)}</td>
                <td className="muted small">{line.notes.join(' ') || 'Paid in full.'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="panel">
        <h2>Claim queue</h2>
        <table className="grid">
          <thead><tr><th>Patient</th><th>Date</th><th>Plan</th><th className="num">Units</th><th className="num">Paid</th><th>Status</th></tr></thead>
          <tbody>
            {queue.map((visit) => (
              <tr key={visit.visitId}>
                <td>{visit.patient}</td>
                <td>{visit.date}</td>
                <td>{visit.payer}</td>
                <td className="num">{visit.pricing.totalUnits}</td>
                <td className="num">{money(visit.pricing.netAllowed)}</td>
                <td>
                  {visit.billable
                    ? <span className="pill ok">ready</span>
                    : <span className="pill blocker">held</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}

function Figure({ label, value, emphasis }: { label: string; value: string; emphasis?: boolean }) {
  return (
    <div className={emphasis ? 'figure emphasis' : 'figure'}>
      <p className="tile-label">{label}</p>
      <p className="tile-value">{value}</p>
    </div>
  )
}
