/**
 * A trimmed Medicare Physician Fee Schedule for the codes an outpatient PT
 * clinic actually bills. Values are illustrative 2026-ish national amounts,
 * NOT a licensed copy of the CMS file — the point is that the engine splits
 * each payment into work / practice-expense / malpractice, because MPPR only
 * reduces the practice-expense slice.
 *
 * Swap this module for a real fee-schedule loader and nothing else changes.
 */

export interface FeeScheduleEntry {
  code: string
  shortDescription: string
  /** Dollars per unit, split into its three RVU-derived components. */
  work: number
  practiceExpense: number
  malpractice: number
  /** Service-based codes bill one unit no matter how long they take. */
  untimed: boolean
  /** 'Always therapy' codes are the ones MPPR looks at. */
  alwaysTherapy: boolean
}

const ENTRIES: FeeScheduleEntry[] = [
  { code: '97110', shortDescription: 'Therapeutic exercise',        work: 10.21, practiceExpense: 19.88, malpractice: 0.71, untimed: false, alwaysTherapy: true },
  { code: '97112', shortDescription: 'Neuromuscular reeducation',   work: 11.24, practiceExpense: 20.41, malpractice: 0.74, untimed: false, alwaysTherapy: true },
  { code: '97116', shortDescription: 'Gait training',               work: 9.52,  practiceExpense: 17.63, malpractice: 0.65, untimed: false, alwaysTherapy: true },
  { code: '97140', shortDescription: 'Manual therapy',              work: 9.86,  practiceExpense: 17.02, malpractice: 0.68, untimed: false, alwaysTherapy: true },
  { code: '97530', shortDescription: 'Therapeutic activities',      work: 12.08, practiceExpense: 21.77, malpractice: 0.79, untimed: false, alwaysTherapy: true },
  { code: '97535', shortDescription: 'Self-care/home management',   work: 11.90, practiceExpense: 20.06, malpractice: 0.77, untimed: false, alwaysTherapy: true },
  { code: '97161', shortDescription: 'PT evaluation, low',          work: 34.22, practiceExpense: 40.31, malpractice: 2.10, untimed: true,  alwaysTherapy: true },
  { code: '97162', shortDescription: 'PT evaluation, moderate',     work: 34.22, practiceExpense: 40.31, malpractice: 2.10, untimed: true,  alwaysTherapy: true },
  { code: '97163', shortDescription: 'PT evaluation, high',         work: 34.22, practiceExpense: 40.31, malpractice: 2.10, untimed: true,  alwaysTherapy: true },
  { code: '97164', shortDescription: 'PT re-evaluation',            work: 23.15, practiceExpense: 27.44, malpractice: 1.42, untimed: true,  alwaysTherapy: true },
  { code: '97010', shortDescription: 'Hot/cold packs',              work: 0,     practiceExpense: 0,     malpractice: 0,    untimed: true,  alwaysTherapy: false },
  { code: '97012', shortDescription: 'Mechanical traction',         work: 5.04,  practiceExpense: 11.87, malpractice: 0.40, untimed: true,  alwaysTherapy: true },
  { code: '97014', shortDescription: 'Electrical stim, unattended', work: 4.31,  practiceExpense: 9.92,  malpractice: 0.35, untimed: true,  alwaysTherapy: true },
]

const BY_CODE = new Map(ENTRIES.map((e) => [e.code, e]))

export function lookup(code: string): FeeScheduleEntry {
  const entry = BY_CODE.get(code)
  if (!entry) throw new Error(`Unknown CPT code: ${code}. Add it to the fee schedule before billing it.`)
  return entry
}

export function allowedPerUnit(entry: FeeScheduleEntry): number {
  return round2(entry.work + entry.practiceExpense + entry.malpractice)
}

export function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100
}

export const feeSchedule = { lookup, allowedPerUnit, entries: ENTRIES }
