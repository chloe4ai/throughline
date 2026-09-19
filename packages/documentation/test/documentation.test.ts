import { describe, it, expect } from 'vitest'
import { serviceLinesFromNote, checkCompliance, hasBlockers } from '../src/index.js'
import type { Note } from '@throughline/domain'

const signedNote = (overrides: Partial<Note> = {}): Note => ({
  id: 'n1', visitId: 'v1',
  subjective: 'Reports 3/10 knee pain, down from 6/10.',
  objective: {
    interventions: [
      { code: '97110', description: 'Quad sets, SLR', minutes: 20 },
      { code: '97140', description: 'Patellar mobilization', minutes: 15 },
    ],
  },
  assessment: 'Improving quad activation; tolerates closed-chain loading without effusion.',
  plan: 'Progress to step-downs next visit.',
  signedBy: 'C. Tan, PT', signedAt: '2026-09-18T18:00:00Z',
  ...overrides,
})

const healthyEpisode = { visitsUsed: 4, authorizedVisits: 12, certificationExpires: '2026-12-01' }

describe('serviceLinesFromNote', () => {
  it('derives billable lines straight from documented interventions', () => {
    const lines = serviceLinesFromNote(signedNote())
    expect(lines).toEqual([
      { code: '97110', minutes: 20, assistantMinutes: 0 },
      { code: '97140', minutes: 15, assistantMinutes: 0 },
    ])
  })

  it('collapses repeated codes into one line so units are counted once', () => {
    const note = signedNote({
      objective: {
        interventions: [
          { code: '97110', description: 'Quad sets', minutes: 12 },
          { code: '97110', description: 'Step-ups', minutes: 11, assistantMinutes: 11 },
        ],
      },
    })
    const lines = serviceLinesFromNote(note)
    expect(lines).toHaveLength(1)
    expect(lines[0]).toEqual({ code: '97110', minutes: 23, assistantMinutes: 11 })
  })
})

describe('checkCompliance', () => {
  const base = { episode: healthyEpisode, visitDate: '2026-09-18', visitsSinceProgressNote: 3 }

  it('passes a clean, signed visit', () => {
    const findings = checkCompliance({ ...base, note: signedNote() })
    expect(hasBlockers(findings)).toBe(false)
  })

  it('blocks an unsigned note', () => {
    const note = signedNote()
    delete note.signedBy
    const findings = checkCompliance({ ...base, note })
    expect(findings.some((f) => f.rule === 'signature' && f.severity === 'blocker')).toBe(true)
  })

  it('blocks a visit billed after the plan of care expired', () => {
    const findings = checkCompliance({
      ...base, note: signedNote(),
      episode: { ...healthyEpisode, certificationExpires: '2026-09-01' },
    })
    expect(findings.some((f) => f.rule === 'plan-of-care-expired')).toBe(true)
  })

  it('warns two weeks before the plan of care expires', () => {
    const findings = checkCompliance({
      ...base, note: signedNote(),
      episode: { ...healthyEpisode, certificationExpires: '2026-09-25' },
    })
    expect(findings.some((f) => f.rule === 'plan-of-care-expiring' && f.severity === 'warning')).toBe(true)
    expect(hasBlockers(findings)).toBe(false)
  })

  it('blocks at the tenth visit without a progress note, and warns at the ninth', () => {
    const due = checkCompliance({ ...base, note: signedNote(), visitsSinceProgressNote: 10 })
    expect(due.some((f) => f.rule === 'progress-note-due' && f.severity === 'blocker')).toBe(true)

    const soon = checkCompliance({ ...base, note: signedNote(), visitsSinceProgressNote: 9 })
    expect(hasBlockers(soon)).toBe(false)
    expect(soon.some((f) => f.rule === 'progress-note-next-visit')).toBe(true)
  })

  it('catches assistant minutes that exceed the time documented', () => {
    const note = signedNote({
      objective: { interventions: [{ code: '97110', description: 'x', minutes: 10, assistantMinutes: 15 }] },
    })
    expect(checkCompliance({ ...base, note }).some((f) => f.rule === 'assistant-minutes-exceed-total')).toBe(true)
  })

  it('flags an exhausted authorization before the claim denies', () => {
    const findings = checkCompliance({
      ...base, note: signedNote(),
      episode: { ...healthyEpisode, visitsUsed: 12 },
    })
    expect(findings.some((f) => f.rule === 'authorization-exhausted')).toBe(true)
  })

  it('leaves a cash-pay episode with no authorization alone', () => {
    const findings = checkCompliance({
      ...base, note: signedNote(),
      episode: { ...healthyEpisode, authorizedVisits: null },
    })
    expect(findings.some((f) => f.rule.startsWith('authorization'))).toBe(false)
  })
})
