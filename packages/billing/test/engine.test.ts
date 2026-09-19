import { describe, it, expect } from 'vitest'
import { priceVisit, splitLiability } from '../src/engine.js'
import { lookup, round2 } from '../src/fee-schedule.js'
import type { Payer, PatientBenefits } from '@throughline/domain'

const medicare: Payer = {
  id: 'medicare', name: 'Medicare Part B',
  unitRule: 'medicare-8-minute', appliesMppr: true,
  appliesAssistantReduction: true, feeScheduleMultiplier: 1,
}

const commercial: Payer = {
  id: 'bcbs', name: 'Commercial PPO',
  unitRule: 'ama-rule-of-eights', appliesMppr: false,
  appliesAssistantReduction: false, feeScheduleMultiplier: 1.35,
}

const metDeductible: PatientBenefits = { deductibleRemaining: 0, coinsurance: 0.2 }

describe('priceVisit', () => {
  it('prices a plain therapist-only Medicare visit', () => {
    const result = priceVisit({
      services: [{ code: '97110', minutes: 30 }],
      payer: medicare, benefits: metDeductible, discipline: 'PT',
    })
    expect(result.totalUnits).toBe(2)
    const entry = lookup('97110')
    const full = round2(entry.work + entry.practiceExpense + entry.malpractice)
    const reduced = round2(entry.work + entry.practiceExpense * 0.5 + entry.malpractice)
    // Two units of one code: MPPR still bites the second unit.
    expect(result.netAllowed).toBe(round2(full + reduced))
    expect(result.reductionTotal).toBeGreaterThan(0)
  })

  it('shows the contract multiplier moving the whole claim', () => {
    const base = priceVisit({
      services: [{ code: '97110', minutes: 30 }],
      payer: { ...commercial, feeScheduleMultiplier: 1 },
      benefits: metDeductible, discipline: 'PT',
    })
    const uplifted = priceVisit({
      services: [{ code: '97110', minutes: 30 }],
      payer: commercial, benefits: metDeductible, discipline: 'PT',
    })
    expect(uplifted.netAllowed).toBeCloseTo(round2(base.netAllowed * 1.35), 1)
  })

  it('never pays more than the full allowed amount', () => {
    const result = priceVisit({
      services: [
        { code: '97110', minutes: 30, assistantMinutes: 30 },
        { code: '97140', minutes: 15 },
        { code: '97012', minutes: 10, untimed: true },
      ],
      payer: medicare, benefits: metDeductible, discipline: 'PT',
    })
    expect(result.netAllowed).toBeLessThanOrEqual(result.grossAllowed)
    expect(result.planPays + result.patientResponsibility).toBeCloseTo(result.netAllowed, 2)
  })

  it('stacks MPPR and the assistant reduction in the right order', () => {
    const result = priceVisit({
      services: [{ code: '97110', minutes: 30, assistantMinutes: 30 }],
      payer: medicare, benefits: metDeductible, discipline: 'PT',
    })
    const entry = lookup('97110')
    const full = round2(entry.work + entry.practiceExpense + entry.malpractice)
    const afterMppr = round2(entry.work + entry.practiceExpense * 0.5 + entry.malpractice)
    // MPPR first on the second unit, then 85% across the line.
    expect(result.netAllowed).toBeCloseTo(round2((full + afterMppr) * 0.85), 2)
    expect(result.lines[0]?.modifier).toBe('CQ')
  })

  it('warns instead of silently billing nothing when the visit is too short', () => {
    const result = priceVisit({
      services: [{ code: '97110', minutes: 6 }],
      payer: medicare, benefits: metDeductible, discipline: 'PT',
    })
    expect(result.totalUnits).toBe(0)
    expect(result.netAllowed).toBe(0)
    expect(result.warnings.join(' ')).toMatch(/8-minute floor/)
  })

  it('bills an evaluation visit as one untimed unit with no MPPR partner', () => {
    const result = priceVisit({
      services: [{ code: '97162', minutes: 45 }],
      payer: medicare, benefits: metDeductible, discipline: 'PT',
    })
    expect(result.totalUnits).toBe(1)
    expect(result.reductionTotal).toBe(0)
  })
})

describe('patient liability', () => {
  it('runs the deductible down before any coinsurance', () => {
    const { patientResponsibility, planPays } = splitLiability(100, { deductibleRemaining: 60, coinsurance: 0.2 })
    // 60 to deductible, 20% of the remaining 40 = 8. Total 68.
    expect(patientResponsibility).toBe(68)
    expect(planPays).toBe(32)
  })

  it('charges a copay instead of coinsurance when the plan uses one', () => {
    const { patientResponsibility } = splitLiability(100, { deductibleRemaining: 0, coinsurance: 0.2, copay: 35 })
    expect(patientResponsibility).toBe(35)
  })

  it('never charges a copay larger than the visit', () => {
    const { patientResponsibility, planPays } = splitLiability(20, { deductibleRemaining: 0, coinsurance: 0.2, copay: 35 })
    expect(patientResponsibility).toBe(20)
    expect(planPays).toBe(0)
  })

  it('puts the whole visit on the patient while the deductible is unmet', () => {
    const { patientResponsibility, planPays } = splitLiability(140, { deductibleRemaining: 500, coinsurance: 0.2 })
    expect(patientResponsibility).toBe(140)
    expect(planPays).toBe(0)
  })
})
