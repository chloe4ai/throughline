import type { Payer, PatientBenefits, ServiceLine, Discipline } from '@throughline/domain'
import { allocateUnits, type UnitAllocation } from './units.js'
import { applyMppr } from './mppr.js'
import { decideModifier, type ModifierDecision } from './modifiers.js'
import { lookup, round2 } from './fee-schedule.js'

/**
 * Compose the rules into one answer: for this visit, on this plan, what will
 * actually be paid, by whom, and why.
 *
 * Order matters and is not arbitrary:
 *   1. minutes -> units        (payer's unit rule)
 *   2. units   -> allowed      (fee schedule x contract multiplier)
 *   3. MPPR on the practice-expense slice of the non-top units
 *   4. CQ/CO 15% reduction on assistant-delivered lines
 *   5. split the remainder into plan liability and patient liability
 *
 * Doing 4 before 3, or applying the contract multiplier after MPPR, produces
 * numbers that are close enough to look right and wrong on every claim.
 */

export interface ClaimLine {
  code: string
  description: string
  units: number
  minutes: number
  modifier: 'CQ' | 'CO' | null
  /** Allowed before MPPR and assistant reduction, at contracted rates. */
  fullAllowed: number
  /** Allowed after every reduction. */
  allowed: number
  mpprUnits: number
  notes: string[]
}

export interface VisitPricing {
  lines: ClaimLine[]
  totalTimedMinutes: number
  totalUnits: number
  /** Allowed amount if no reduction applied — the number clinics assume. */
  grossAllowed: number
  /** Allowed amount after MPPR and assistant reductions. */
  netAllowed: number
  reductionTotal: number
  patientResponsibility: number
  planPays: number
  warnings: string[]
}

export interface PriceVisitInput {
  services: ServiceLine[]
  payer: Payer
  benefits: PatientBenefits
  discipline: Discipline
}

export function priceVisit({ services, payer, benefits, discipline }: PriceVisitInput): VisitPricing {
  const allocations = allocateUnits(services, payer)
  const warnings: string[] = []

  const timedMinutes = services
    .filter((s) => !(s.untimed ?? lookup(s.code).untimed))
    .reduce((sum, s) => sum + s.minutes, 0)

  const billableUnits = allocations.reduce((sum, a) => sum + a.units, 0)
  if (timedMinutes > 0 && timedMinutes < 8) {
    warnings.push(`Only ${timedMinutes} timed minutes documented — under the 8-minute floor, no timed units are billable.`)
  }

  const mpprUnits = applyMppr(allocations, payer.appliesMppr)

  const lines: ClaimLine[] = allocations.map((allocation) => {
    const entry = lookup(allocation.code)
    const modifier = decideModifier(allocation, discipline, payer.appliesAssistantReduction)
    const unitsForCode = mpprUnits.filter((u) => u.code === allocation.code)

    const fullAllowed = round2(
      unitsForCode.reduce((sum, u) => sum + u.fullAllowed, 0) * payer.feeScheduleMultiplier,
    )
    const afterMppr = unitsForCode.reduce((sum, u) => sum + u.reducedAllowed, 0) * payer.feeScheduleMultiplier
    const allowed = round2(afterMppr * modifier.paymentRate)

    const notes: string[] = []
    const reducedCount = unitsForCode.filter((u) => u.mpprApplied).length
    if (reducedCount > 0) notes.push(`MPPR applied to ${reducedCount} of ${unitsForCode.length} unit(s): practice expense paid at 50%.`)
    if (modifier.modifier) notes.push(`${modifier.modifier} modifier — ${modifier.reason}. Paid at ${(modifier.paymentRate * 100).toFixed(0)}%.`)
    else if (allocation.assistantMinutes > 0) notes.push(modifier.reason)

    return {
      code: allocation.code,
      description: entry.shortDescription,
      units: allocation.units,
      minutes: allocation.minutes,
      modifier: modifier.modifier,
      fullAllowed,
      allowed,
      mpprUnits: reducedCount,
      notes,
    }
  })

  const grossAllowed = round2(lines.reduce((sum, l) => sum + l.fullAllowed, 0))
  const netAllowed = round2(lines.reduce((sum, l) => sum + l.allowed, 0))

  const { patientResponsibility, planPays } = splitLiability(netAllowed, benefits)

  return {
    lines,
    totalTimedMinutes: timedMinutes,
    totalUnits: billableUnits,
    grossAllowed,
    netAllowed,
    reductionTotal: round2(grossAllowed - netAllowed),
    patientResponsibility,
    planPays,
    warnings,
  }
}

/**
 * Deductible first, then copay OR coinsurance — never both, which is the
 * mistake that makes a patient statement wrong by exactly the copay.
 */
export function splitLiability(
  netAllowed: number,
  benefits: PatientBenefits,
): { patientResponsibility: number; planPays: number } {
  const towardDeductible = Math.min(netAllowed, Math.max(0, benefits.deductibleRemaining))
  const afterDeductible = netAllowed - towardDeductible

  const share =
    benefits.copay != null
      ? Math.min(benefits.copay, afterDeductible)
      : round2(afterDeductible * benefits.coinsurance)

  const patientResponsibility = round2(towardDeductible + share)
  return { patientResponsibility, planPays: round2(netAllowed - patientResponsibility) }
}

export type { UnitAllocation, ModifierDecision }
