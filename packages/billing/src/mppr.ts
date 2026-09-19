import { lookup, round2 } from './fee-schedule.js'
import type { UnitAllocation } from './units.js'

/**
 * Multiple Procedure Payment Reduction.
 *
 * When more than one "always therapy" procedure is furnished to the same
 * patient on the same day, Medicare pays the full amount for the single
 * highest-valued procedure and reduces the PRACTICE EXPENSE component of every
 * other unit by 50%. Work and malpractice are untouched.
 *
 * Two details clinics get wrong:
 *  - Ranking is by practice expense per unit, not by total allowed amount.
 *  - The reduction applies per UNIT, not per line: the first unit of the top
 *    code is spared, and the remaining units of that same code are reduced.
 */

export interface MpprUnit {
  code: string
  /** Full allowed amount for this one unit. */
  fullAllowed: number
  /** Allowed amount after any MPPR reduction. */
  reducedAllowed: number
  mpprApplied: boolean
}

export const MPPR_PRACTICE_EXPENSE_RETAINED = 0.5

export function applyMppr(allocations: UnitAllocation[], enabled: boolean): MpprUnit[] {
  const units: Array<MpprUnit & { practiceExpense: number; alwaysTherapy: boolean }> = []

  for (const allocation of allocations) {
    const entry = lookup(allocation.code)
    const full = round2(entry.work + entry.practiceExpense + entry.malpractice)
    for (let i = 0; i < allocation.units; i += 1) {
      units.push({
        code: allocation.code,
        fullAllowed: full,
        reducedAllowed: full,
        mpprApplied: false,
        practiceExpense: entry.practiceExpense,
        alwaysTherapy: entry.alwaysTherapy,
      })
    }
  }

  if (!enabled) return units.map(strip)

  const therapyUnits = units.filter((u) => u.alwaysTherapy)
  if (therapyUnits.length <= 1) return units.map(strip)

  // Highest practice expense per unit is spared; everything else is reduced.
  const ranked = [...therapyUnits].sort((a, b) => b.practiceExpense - a.practiceExpense)
  const spared = ranked[0]!
  for (const unit of ranked) {
    if (unit === spared) continue
    const entry = lookup(unit.code)
    unit.reducedAllowed = round2(
      entry.work + entry.practiceExpense * MPPR_PRACTICE_EXPENSE_RETAINED + entry.malpractice,
    )
    unit.mpprApplied = true
  }

  return units.map(strip)
}

function strip(u: MpprUnit & { practiceExpense: number; alwaysTherapy: boolean }): MpprUnit {
  return { code: u.code, fullAllowed: u.fullAllowed, reducedAllowed: u.reducedAllowed, mpprApplied: u.mpprApplied }
}
