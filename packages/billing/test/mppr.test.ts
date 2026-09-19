import { describe, it, expect } from 'vitest'
import { applyMppr } from '../src/mppr.js'
import { lookup, round2 } from '../src/fee-schedule.js'
import type { UnitAllocation } from '../src/units.js'

const alloc = (code: string, units: number): UnitAllocation => ({
  code, units, minutes: units * 15, assistantMinutes: 0, untimed: false,
})

describe('MPPR', () => {
  it('does nothing when the payer does not apply it', () => {
    const units = applyMppr([alloc('97110', 2), alloc('97140', 1)], false)
    expect(units.every((u) => !u.mpprApplied)).toBe(true)
  })

  it('does nothing when only one therapy unit is billed', () => {
    const units = applyMppr([alloc('97110', 1)], true)
    expect(units[0]?.mpprApplied).toBe(false)
  })

  it('spares exactly one unit — the one with the highest practice expense', () => {
    // 97530 has the highest practice expense of the three.
    const units = applyMppr([alloc('97110', 1), alloc('97140', 1), alloc('97530', 1)], true)
    const spared = units.filter((u) => !u.mpprApplied)
    expect(spared).toHaveLength(1)
    expect(spared[0]?.code).toBe('97530')
  })

  it('reduces the other units of the top code too, not just the other codes', () => {
    const units = applyMppr([alloc('97530', 3)], true)
    expect(units.filter((u) => u.mpprApplied)).toHaveLength(2)
    expect(units.filter((u) => !u.mpprApplied)).toHaveLength(1)
  })

  it('halves the practice expense and leaves work and malpractice alone', () => {
    const units = applyMppr([alloc('97110', 2)], true)
    const entry = lookup('97110')
    const reduced = units.find((u) => u.mpprApplied)!
    expect(reduced.reducedAllowed).toBe(
      round2(entry.work + entry.practiceExpense * 0.5 + entry.malpractice),
    )
    // The reduction is worth half the practice expense, nothing more.
    expect(round2(reduced.fullAllowed - reduced.reducedAllowed)).toBe(round2(entry.practiceExpense * 0.5))
  })

  it('ignores codes that are not always-therapy', () => {
    // 97010 (hot/cold packs) is not an always-therapy code and carries no value.
    const units = applyMppr([alloc('97110', 1), { ...alloc('97010', 1), untimed: true }], true)
    expect(units.filter((u) => u.mpprApplied)).toHaveLength(0)
  })
})
