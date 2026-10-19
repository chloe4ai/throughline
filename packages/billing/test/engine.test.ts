import { describe, it, expect } from 'vitest'
import { priceVisit, splitLiability } from '../src/engine.js'
import { validateServices } from '../src/validate.js'
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

describe('duplicate codes on one visit', () => {
  const split = [{ code: '97110', minutes: 20 }, { code: '97110', minutes: 20 }]
  const combined = [{ code: '97110', minutes: 40 }]

  for (const payer of [medicare, commercial]) {
    it(`prices two lines of one code like one line with their summed minutes (${payer.unitRule})`, () => {
      const a = priceVisit({ services: split, payer, benefits: metDeductible, discipline: 'PT' })
      const b = priceVisit({ services: combined, payer, benefits: metDeductible, discipline: 'PT' })
      expect(a.totalUnits).toBe(b.totalUnits)
      expect(a.lines).toHaveLength(1)
      expect(a.lines[0]?.units).toBe(b.lines[0]?.units)
      expect(a.lines[0]?.fullAllowed).toBe(b.lines[0]?.fullAllowed)
      expect(a.grossAllowed).toBe(b.grossAllowed)
      expect(a.netAllowed).toBe(b.netAllowed)
    })
  }

  it('does not double-count the Medicare claim (3 units billed, 3 units paid)', () => {
    const result = priceVisit({ services: split, payer: medicare, benefits: metDeductible, discipline: 'PT' })
    const entry = lookup('97110')
    const full = round2(entry.work + entry.practiceExpense + entry.malpractice)
    expect(result.totalUnits).toBe(3)
    expect(result.grossAllowed).toBe(round2(full * 3))
  })

  it('sums assistant minutes across merged lines', () => {
    const a = priceVisit({
      services: [{ code: '97110', minutes: 20, assistantMinutes: 10 }, { code: '97110', minutes: 20, assistantMinutes: 10 }],
      payer: medicare, benefits: metDeductible, discipline: 'PT',
    })
    const b = priceVisit({
      services: [{ code: '97110', minutes: 40, assistantMinutes: 20 }],
      payer: medicare, benefits: metDeductible, discipline: 'PT',
    })
    expect(a.lines[0]?.modifier).toBe(b.lines[0]?.modifier)
    expect(a.netAllowed).toBe(b.netAllowed)
  })
})

describe('input validation', () => {
  const price = (services: unknown) =>
    priceVisit({ services: services as never, payer: medicare, benefits: metDeductible, discipline: 'PT' })

  it('rejects input that is not an array', () => {
    expect(() => validateServices(null)).toThrow(/must be an array/)
    expect(() => price({ code: '97110', minutes: 20 })).toThrow(/must be an array/)
  })

  it('rejects minutes that are not a number', () => {
    expect(() => price([{ code: '97110', minutes: 'abc' }])).toThrow(/minutes must be a finite, non-negative number/)
  })

  it('rejects negative minutes', () => {
    expect(() => price([{ code: '97110', minutes: -5 }])).toThrow(/non-negative/)
  })

  it('rejects assistant minutes greater than the line\'s minutes', () => {
    expect(() => price([{ code: '97110', minutes: 15, assistantMinutes: 99 }])).toThrow(/cannot exceed minutes/)
  })

  it('accepts a well-formed visit', () => {
    expect(() => validateServices([{ code: '97110', minutes: 15, assistantMinutes: 15 }, { code: '97162', minutes: 0 }])).not.toThrow()
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
