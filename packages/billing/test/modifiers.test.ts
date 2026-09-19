import { describe, it, expect } from 'vitest'
import { decideModifier } from '../src/modifiers.js'

const line = (minutes: number, assistantMinutes: number) => ({
  code: '97110', minutes, assistantMinutes, untimed: false,
})

describe('CQ/CO de minimis standard', () => {
  it('does not trigger at exactly 10% — the rule is MORE than 10%', () => {
    const decision = decideModifier(line(30, 3), 'PT', true)
    expect(decision.modifier).toBeNull()
    expect(decision.paymentRate).toBe(1)
  })

  it('triggers just over 10%', () => {
    const decision = decideModifier(line(30, 4), 'PT', true)
    expect(decision.modifier).toBe('CQ')
    expect(decision.paymentRate).toBe(0.85)
  })

  it('uses CO for occupational therapy', () => {
    expect(decideModifier(line(30, 20), 'OT', true).modifier).toBe('CO')
  })

  it('has no assistant modifier for speech therapy', () => {
    const decision = decideModifier(line(30, 30), 'SLP', true)
    expect(decision.modifier).toBeNull()
  })

  it('reports the modifier but not the cut when the payer does not honor it', () => {
    const decision = decideModifier(line(30, 20), 'PT', false)
    expect(decision.modifier).toBe('CQ')
    expect(decision.paymentRate).toBe(1)
  })

  it('treats any assistant delivery of an untimed code as the whole service', () => {
    const decision = decideModifier({ code: '97012', minutes: 0, assistantMinutes: 5, untimed: true }, 'PT', true)
    expect(decision.modifier).toBe('CQ')
    expect(decision.assistantShare).toBe(1)
  })

  it('is silent when no assistant was involved', () => {
    const decision = decideModifier(line(30, 0), 'PT', true)
    expect(decision.modifier).toBeNull()
    expect(decision.reason).toMatch(/Therapist/)
  })
})
