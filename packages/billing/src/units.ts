import type { ServiceLine, Payer } from '@throughline/domain'
import { lookup } from './fee-schedule.js'

/**
 * Units of service.
 *
 * This is the single most expensive thing a PT clinic gets wrong, because it
 * is wrong quietly: the claim pays, and the error only surfaces years later in
 * an audit as an overpayment demand. The two rules below genuinely disagree,
 * and which one applies is a property of the PAYER, not of the clinic.
 *
 *   Medicare 8-minute rule: add up ALL timed minutes in the day, then convert
 *   the total once. 8-22 -> 1, 23-37 -> 2, 38-52 -> 3, ... (+1 per 15 min).
 *   Leftover minutes from different codes pool together.
 *
 *   AMA "rule of eights": each code is converted on its OWN minutes, using the
 *   midpoint of each 15-minute increment (>= 8 minutes into the increment).
 *   Leftovers do NOT pool.
 *
 * Worked difference, and the reason this module exists:
 *   97110 for 20 min + 97140 for 20 min = 40 timed minutes.
 *   Medicare: 40 total -> 3 units.   AMA: 1 unit + 1 unit -> 2 units.
 */

export interface UnitAllocation {
  code: string
  units: number
  minutes: number
  assistantMinutes: number
  untimed: boolean
}

/** Total timed minutes -> billable units, Medicare substitution table. */
export function unitsFromTotalMinutes(totalMinutes: number): number {
  if (totalMinutes < 8) return 0
  return Math.floor((totalMinutes - 8) / 15) + 1
}

/** One code's own minutes -> units, AMA rule of eights. */
export function unitsForSingleCode(minutes: number): number {
  if (minutes < 8) return 0
  return Math.floor((minutes - 8) / 15) + 1
}

function isUntimed(line: ServiceLine): boolean {
  return line.untimed ?? lookup(line.code).untimed
}

/**
 * Collapse lines that share a CPT code into one line per code (minutes and
 * assistant minutes summed, every other field taken from the first line).
 * A code is billed once per day with a unit count; two lines for the same
 * code must price exactly like one line carrying their combined time.
 */
export function mergeLinesByCode(lines: ServiceLine[]): ServiceLine[] {
  const byCode = new Map<string, ServiceLine>()
  for (const line of lines) {
    const existing = byCode.get(line.code)
    if (!existing) {
      byCode.set(line.code, { ...line })
      continue
    }
    existing.minutes = (existing.minutes ?? 0) + (line.minutes ?? 0)
    if (existing.assistantMinutes != null || line.assistantMinutes != null) {
      existing.assistantMinutes = (existing.assistantMinutes ?? 0) + (line.assistantMinutes ?? 0)
    }
  }
  return [...byCode.values()]
}

/**
 * Allocate units across a day's service lines.
 *
 * Under the Medicare rule the day's total decides how many units exist; those
 * units are then handed out to codes longest-first, which is the allocation
 * CMS describes when leftover minutes have to be assigned to one code.
 */
export function allocateUnits(serviceLines: ServiceLine[], payer: Pick<Payer, 'unitRule'>): UnitAllocation[] {
  const lines = mergeLinesByCode(serviceLines)
  const timed = lines.filter((l) => !isUntimed(l))
  const untimed = lines.filter(isUntimed)

  const untimedAllocations: UnitAllocation[] = untimed.map((l) => ({
    code: l.code,
    units: 1,
    minutes: l.minutes ?? 0,
    assistantMinutes: l.assistantMinutes ?? 0,
    untimed: true,
  }))

  if (payer.unitRule === 'ama-rule-of-eights') {
    const timedAllocations = timed.map((l) => ({
      code: l.code,
      units: unitsForSingleCode(l.minutes),
      minutes: l.minutes,
      assistantMinutes: l.assistantMinutes ?? 0,
      untimed: false,
    }))
    return [...timedAllocations, ...untimedAllocations].filter((a) => a.units > 0 || a.untimed)
  }

  const totalMinutes = timed.reduce((sum, l) => sum + l.minutes, 0)
  let remaining = unitsFromTotalMinutes(totalMinutes)

  // Give every code the units its own minutes fully earn (each 15 minutes),
  // then hand the leftover unit(s) to whichever code has the most unbilled
  // time. Ties break toward the code with more total minutes, then by order.
  const ordered = [...timed]
    .map((l, index) => ({ line: l, index }))
    .sort((a, b) => b.line.minutes - a.line.minutes || a.index - b.index)

  const base = new Map<number, number>()
  for (const { line, index } of ordered) {
    const full = Math.floor(line.minutes / 15)
    base.set(index, full)
    remaining -= full
  }

  const leftover = new Map<number, number>()
  for (const { line, index } of ordered) leftover.set(index, line.minutes % 15)

  const byLeftover = [...ordered].sort((a, b) => {
    const la = leftover.get(a.index) ?? 0
    const lb = leftover.get(b.index) ?? 0
    return lb - la || b.line.minutes - a.line.minutes || a.index - b.index
  })

  let i = 0
  while (remaining > 0 && byLeftover.length > 0) {
    const target = byLeftover[i % byLeftover.length]!
    base.set(target.index, (base.get(target.index) ?? 0) + 1)
    remaining -= 1
    i += 1
  }

  const timedAllocations: UnitAllocation[] = timed.map((l, index) => ({
    code: l.code,
    units: base.get(index) ?? 0,
    minutes: l.minutes,
    assistantMinutes: l.assistantMinutes ?? 0,
    untimed: false,
  }))

  return [...timedAllocations, ...untimedAllocations].filter((a) => a.units > 0 || a.untimed)
}
