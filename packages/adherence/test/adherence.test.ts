import { describe, it, expect } from 'vitest'
import { summarizeAdherence, addDays } from '../src/index.js'
import type { HomeProgram, AdherenceEvent } from '@throughline/domain'

const ASOF = '2026-09-18'

const program: HomeProgram = {
  id: 'p1', episodeId: 'e1', assignedOn: '2026-08-20',
  exercises: [
    { id: 'quad-sets', name: 'Quad sets', prescribedPerWeek: 7, sets: 3, reps: 10 },
    { id: 'balance', name: 'Single-leg balance', prescribedPerWeek: 7, sets: 3, reps: 1 },
  ],
}

let seq = 0
const event = (exerciseId: string, daysAgo: number, painScore?: number): AdherenceEvent => ({
  id: `ev${seq++}`, programId: 'p1', exerciseId,
  completedOn: addDays(ASOF, -daysAgo),
  ...(painScore != null ? { painScore } : {}),
  source: 'patient-app',
})

const everyDay = (exerciseId: string, days = 14) =>
  Array.from({ length: days }, (_, i) => event(exerciseId, i))

describe('summarizeAdherence', () => {
  it('scores a fully adherent patient on track', () => {
    const summary = summarizeAdherence(program, [...everyDay('quad-sets'), ...everyDay('balance')], { asOf: ASOF })
    expect(summary.score).toBe(1)
    expect(summary.risk).toBe('on-track')
    expect(summary.currentStreak).toBe(14)
  })

  it('does not let one exercise cover for another', () => {
    // Quad sets done 28 times, balance never. Naive totals would say 100%.
    const doubled = [...everyDay('quad-sets'), ...everyDay('quad-sets')]
    const summary = summarizeAdherence(program, doubled, { asOf: ASOF })
    expect(summary.score).toBeCloseTo(0.5, 2)
    expect(summary.recommendation).toMatch(/Single-leg balance/)
  })

  it('puts the slipping/at-risk boundary at 0.5, inclusive of slipping', () => {
    // Exactly half the program done is 'slipping'; one session less is 'at-risk'.
    const half = [...everyDay('quad-sets')]
    expect(summarizeAdherence(program, half, { asOf: ASOF }).risk).toBe('slipping')

    const justUnder = half.slice(0, half.length - 1)
    expect(summarizeAdherence(program, justUnder, { asOf: ASOF }).risk).toBe('at-risk')
  })

  it('calls a silent patient disengaged, not merely slipping', () => {
    const stale = [...everyDay('quad-sets', 3).map((e) => ({ ...e, completedOn: addDays(ASOF, -12) }))]
    const summary = summarizeAdherence(program, stale, { asOf: ASOF })
    expect(summary.risk).toBe('disengaged')
    expect(summary.daysSinceLastActivity).toBe(12)
    expect(summary.recommendation).toMatch(/dropout window/)
  })

  it('handles a patient who has never logged anything', () => {
    const summary = summarizeAdherence(program, [], { asOf: ASOF })
    expect(summary.score).toBe(0)
    expect(summary.daysSinceLastActivity).toBeNull()
    expect(summary.risk).toBe('disengaged')
    expect(summary.recommendation).toMatch(/never logged/)
  })

  it('downgrades a compliant patient whose pain is climbing', () => {
    const rising = [
      ...[6, 5, 4, 3, 2, 1, 0].map((d, i) => event('quad-sets', d, 3 + i * 0.6)),
      ...[6, 5, 4, 3, 2, 1, 0].map((d) => event('balance', d)),
      ...[13, 12, 11, 10, 9, 8, 7].map((d) => event('quad-sets', d)),
      ...[13, 12, 11, 10, 9, 8, 7].map((d) => event('balance', d)),
    ]
    const summary = summarizeAdherence(program, rising, { asOf: ASOF })
    expect(summary.score).toBe(1)
    expect(summary.painTrend).toBe('worsening')
    expect(summary.risk).toBe('slipping')
    expect(summary.recommendation).toMatch(/dosage/)
  })

  it('prorates expectations for a program assigned mid-window', () => {
    const fresh: HomeProgram = { ...program, id: 'p1', assignedOn: addDays(ASOF, -6) }
    const events = [
      ...Array.from({ length: 7 }, (_, i) => event('quad-sets', i)),
      ...Array.from({ length: 7 }, (_, i) => event('balance', i)),
    ]
    const summary = summarizeAdherence(fresh, events, { asOf: ASOF })
    // Seven days of program, seven of each exercise done — not penalized for
    // the week before it was ever assigned.
    expect(summary.score).toBe(1)
    expect(summary.expectedSessions).toBe(14)
  })

  it('counts the streak only to the last unbroken day', () => {
    const events = [event('quad-sets', 0), event('quad-sets', 1), event('quad-sets', 3)]
    expect(summarizeAdherence(program, events, { asOf: ASOF }).currentStreak).toBe(2)
  })

  it('ignores events belonging to a different program', () => {
    const other = everyDay('quad-sets').map((e) => ({ ...e, programId: 'other' }))
    const summary = summarizeAdherence(program, other, { asOf: ASOF })
    expect(summary.completedSessions).toBe(0)
  })
})
