import type { Payer, PatientBenefits, ServiceLine } from '@throughline/domain'
import { isEvaluation, lookup } from './fee-schedule.js'

/**
 * Reject inputs the engine cannot price honestly. Minutes are the input every
 * dollar is derived from, so a string, a negative or fractional number, or
 * assistant time exceeding the line's own time is an error, not something to
 * coerce. The same goes for benefits and payer terms: a coinsurance of 20
 * instead of 0.2 must fail loudly, not produce a negative plan payment.
 */
export function validateServices(lines: unknown): asserts lines is ServiceLine[] {
  if (!Array.isArray(lines)) {
    throw new Error('services must be an array of service lines.')
  }
  lines.forEach((line: unknown, index) => {
    const where = `services[${index}]`
    if (line === null || typeof line !== 'object') {
      throw new Error(`${where} must be an object with a code and minutes.`)
    }
    const record = line as Record<string, unknown>
    const { code, assistantMinutes, untimed } = record
    if (typeof code !== 'string' || code.length === 0) {
      throw new Error(`${where}.code must be a non-empty string.`)
    }
    const entry = lookup(code)

    // The fee schedule decides whether a code is timed. A caller-supplied flag
    // that disagrees would let 20 minutes of a timed code drop out of the
    // 8-minute total while still billing units, so it is rejected.
    if (untimed !== undefined && untimed !== null && untimed !== entry.untimed) {
      throw new Error(
        `${where} (${code}): untimed is ${JSON.stringify(untimed)} but the fee schedule lists ${code} as ${entry.untimed ? 'untimed' : 'timed'}.`,
      )
    }

    // Service-based (untimed) codes bill one unit regardless of time, so their
    // minutes may be omitted. Timed codes must carry whole minutes.
    if (entry.untimed && (record.minutes === undefined || record.minutes === null)) {
      record.minutes = 0
    }
    const minutes = record.minutes
    if (typeof minutes !== 'number' || !Number.isInteger(minutes) || minutes < 0) {
      throw new Error(`${where} (${code}): minutes must be a whole, non-negative number; got ${JSON.stringify(minutes)}.`)
    }

    if (assistantMinutes !== undefined && assistantMinutes !== null) {
      if (typeof assistantMinutes !== 'number' || !Number.isInteger(assistantMinutes) || assistantMinutes < 0) {
        throw new Error(`${where} (${code}): assistantMinutes must be a whole, non-negative number; got ${JSON.stringify(assistantMinutes)}.`)
      }
      if (!entry.untimed && assistantMinutes > minutes) {
        throw new Error(`${where} (${code}): assistantMinutes (${assistantMinutes}) cannot exceed minutes (${minutes}).`)
      }
      if (assistantMinutes > 0 && isEvaluation(code)) {
        throw new Error(`${where} (${code}): evaluations and re-evaluations must be furnished by the therapist; a PTA or OTA cannot perform them.`)
      }
    }
  })
}

const isNonNegative = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n) && n >= 0

export function validateBenefits(benefits: unknown): asserts benefits is PatientBenefits {
  if (benefits === null || typeof benefits !== 'object') {
    throw new Error('benefits must be an object with deductibleRemaining and a copay or coinsurance.')
  }
  const { deductibleRemaining, copay, coinsurance } = benefits as Record<string, unknown>
  if (!isNonNegative(deductibleRemaining)) {
    throw new Error(`benefits.deductibleRemaining must be a non-negative dollar amount; got ${JSON.stringify(deductibleRemaining)}.`)
  }
  if (copay !== undefined && copay !== null) {
    if (!isNonNegative(copay)) {
      throw new Error(`benefits.copay must be a non-negative dollar amount; got ${JSON.stringify(copay)}.`)
    }
    return
  }
  if (!isNonNegative(coinsurance) || coinsurance > 1) {
    throw new Error(
      `benefits.coinsurance must be a fraction between 0 and 1 (0.2 means 20%) when there is no copay; got ${JSON.stringify(coinsurance)}.`,
    )
  }
}

export function validatePayer(payer: unknown): asserts payer is Payer {
  if (payer === null || typeof payer !== 'object') throw new Error('payer must be an object.')
  const { unitRule, feeScheduleMultiplier } = payer as Record<string, unknown>
  if (unitRule !== 'medicare-8-minute' && unitRule !== 'ama-rule-of-eights') {
    throw new Error(`payer.unitRule must be 'medicare-8-minute' or 'ama-rule-of-eights'; got ${JSON.stringify(unitRule)}.`)
  }
  if (typeof feeScheduleMultiplier !== 'number' || !Number.isFinite(feeScheduleMultiplier) || feeScheduleMultiplier <= 0) {
    throw new Error(`payer.feeScheduleMultiplier must be a positive number; got ${JSON.stringify(feeScheduleMultiplier)}.`)
  }
}
