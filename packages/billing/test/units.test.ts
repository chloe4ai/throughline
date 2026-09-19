import { describe, it, expect } from 'vitest'
import { allocateUnits, unitsFromTotalMinutes, unitsForSingleCode } from '../src/units.js'
import type { Payer } from '@throughline/domain'

const medicare: Pick<Payer, 'unitRule'> = { unitRule: 'medicare-8-minute' }
const commercialAma: Pick<Payer, 'unitRule'> = { unitRule: 'ama-rule-of-eights' }

describe('8-minute rule substitution table', () => {
  it('pays nothing under 8 minutes', () => {
    expect(unitsFromTotalMinutes(0)).toBe(0)
    expect(unitsFromTotalMinutes(7)).toBe(0)
  })

  it('matches the CMS table at every boundary', () => {
    const boundaries: Array<[number, number]> = [
      [8, 1], [22, 1],
      [23, 2], [37, 2],
      [38, 3], [52, 3],
      [53, 4], [67, 4],
      [68, 5], [82, 5],
      [83, 6], [97, 6],
    ]
    for (const [minutes, expected] of boundaries) {
      expect(unitsFromTotalMinutes(minutes), `${minutes} minutes`).toBe(expected)
    }
  })
})

describe('AMA rule of eights', () => {
  it('converts each code on its own minutes', () => {
    expect(unitsForSingleCode(7)).toBe(0)
    expect(unitsForSingleCode(8)).toBe(1)
    expect(unitsForSingleCode(22)).toBe(1)
    expect(unitsForSingleCode(23)).toBe(2)
  })
})

describe('the two rules genuinely disagree', () => {
  const services = [
    { code: '97110', minutes: 20 },
    { code: '97140', minutes: 20 },
  ]

  it('Medicare pools leftovers into a third unit', () => {
    const total = allocateUnits(services, medicare).reduce((s, a) => s + a.units, 0)
    expect(total).toBe(3)
  })

  it('AMA does not pool, so the same visit is worth one unit less', () => {
    const total = allocateUnits(services, commercialAma).reduce((s, a) => s + a.units, 0)
    expect(total).toBe(2)
  })
})

describe('leftover allocation under Medicare', () => {
  it('gives the extra unit to the code with the most unbilled time', () => {
    const allocations = allocateUnits(
      [
        { code: '97110', minutes: 18 }, // 1 full unit + 3 leftover
        { code: '97140', minutes: 12 }, // 0 full units + 12 leftover
      ],
      medicare,
    )
    // 30 total minutes -> 2 units. 97110 earns one outright; the spare goes to
    // 97140, which has 12 unbilled minutes against 97110's 3.
    expect(allocations.find((a) => a.code === '97110')?.units).toBe(1)
    expect(allocations.find((a) => a.code === '97140')?.units).toBe(1)
  })

  it('spreads multiple spare units across the codes that earned none', () => {
    const allocations = allocateUnits(
      [
        { code: '97110', minutes: 10 },
        { code: '97140', minutes: 10 },
        { code: '97530', minutes: 10 },
      ],
      medicare,
    )
    // 30 minutes -> 2 units for three codes that each earned 0 outright.
    expect(allocations.reduce((s, a) => s + a.units, 0)).toBe(2)
    expect(allocations.filter((a) => a.units === 1)).toHaveLength(2)
  })

  it('never invents units the total minutes did not earn', () => {
    const cases = [
      [[{ code: '97110', minutes: 7 }, { code: '97140', minutes: 7 }], 1], // 14 total -> 1
      [[{ code: '97110', minutes: 7 }, { code: '97140', minutes: 0 }], 0], // 7 total  -> 0
      [[{ code: '97110', minutes: 53 }], 4],
    ] as const
    for (const [services, expected] of cases) {
      const total = allocateUnits([...services], medicare).reduce((s, a) => s + a.units, 0)
      expect(total).toBe(expected)
    }
  })
})

describe('untimed codes', () => {
  it('bill one unit and stay out of the timed total', () => {
    const allocations = allocateUnits(
      [
        { code: '97110', minutes: 20 },
        { code: '97012', minutes: 15, untimed: true }, // mechanical traction
      ],
      medicare,
    )
    expect(allocations.find((a) => a.code === '97012')?.units).toBe(1)
    // 20 timed minutes alone -> 1 unit, not 2. The traction minutes do not count.
    expect(allocations.find((a) => a.code === '97110')?.units).toBe(1)
  })

  it('treats an evaluation as untimed even when minutes are recorded', () => {
    const allocations = allocateUnits([{ code: '97162', minutes: 45 }], medicare)
    expect(allocations).toHaveLength(1)
    expect(allocations[0]?.units).toBe(1)
  })
})
