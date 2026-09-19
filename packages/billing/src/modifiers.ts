import type { UnitAllocation } from './units.js'
import type { Discipline } from '@throughline/domain'

/**
 * CQ / CO assistant modifiers.
 *
 * A service furnished "in whole or in substantial part" by a PTA (CQ) or OTA
 * (CO) is paid at 85%. "Substantial part" means MORE THAN 10% of the total
 * time for that service — the de minimis standard. Exactly 10% does not
 * trigger it, which is why this is a strict greater-than.
 *
 * The comparison is per service line, not per visit: a therapist can lead the
 * visit and still have one line that is substantially assistant-delivered.
 */

export const DE_MINIMIS_THRESHOLD = 0.1
export const ASSISTANT_PAYMENT_RATE = 0.85

export interface ModifierDecision {
  code: string
  modifier: 'CQ' | 'CO' | null
  assistantShare: number
  /** Multiplier to apply to this line's allowed amount. */
  paymentRate: number
  reason: string
}

export function decideModifier(
  allocation: Pick<UnitAllocation, 'code' | 'minutes' | 'assistantMinutes' | 'untimed'>,
  discipline: Discipline,
  payerHonorsReduction: boolean,
): ModifierDecision {
  const assistantMinutes = allocation.assistantMinutes ?? 0
  const totalMinutes = allocation.minutes ?? 0

  if (assistantMinutes <= 0) {
    return { code: allocation.code, modifier: null, assistantShare: 0, paymentRate: 1, reason: 'Therapist-delivered' }
  }

  // An untimed code has no minutes to apportion: any assistant delivery of a
  // service-based code is the whole service.
  const share = allocation.untimed || totalMinutes === 0 ? 1 : assistantMinutes / totalMinutes
  const substantial = share > DE_MINIMIS_THRESHOLD

  if (!substantial) {
    return {
      code: allocation.code,
      modifier: null,
      assistantShare: share,
      paymentRate: 1,
      reason: `Assistant time ${(share * 100).toFixed(1)}% is at or under the 10% de minimis standard`,
    }
  }

  if (discipline === 'SLP') {
    return { code: allocation.code, modifier: null, assistantShare: share, paymentRate: 1, reason: 'No assistant modifier exists for SLP' }
  }

  const modifier = discipline === 'PT' ? 'CQ' : 'CO'
  return {
    code: allocation.code,
    modifier,
    assistantShare: share,
    paymentRate: payerHonorsReduction ? ASSISTANT_PAYMENT_RATE : 1,
    reason: `Assistant furnished ${(share * 100).toFixed(1)}% of the service, above the 10% de minimis standard`,
  }
}
