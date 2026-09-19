import type { HomeProgram, AdherenceEvent, ISODate } from '@throughline/domain'

/**
 * Home-exercise adherence.
 *
 * The clinical literature is blunt: most of the outcome happens between
 * visits, and roughly half of patients do not do the program. A clinic cannot
 * bill for adherence directly, so the product case is indirect and has to be
 * made honestly — adherence data is what lets a therapist intervene before a
 * patient silently drops out, and dropout is the clinic's real revenue leak.
 *
 * Scoring choices worth arguing with:
 *  - The window is rolling and recent, because a great first week does not
 *    make a patient adherent today.
 *  - Completion is capped per exercise at what was prescribed: doing quad sets
 *    twelve times cannot paper over never doing the balance work.
 *  - A rising pain trend downgrades risk even when completion looks fine,
 *    because "doing it and hurting" is the case that needs a call today.
 */

export const DEFAULT_WINDOW_DAYS = 14

export type AdherenceRisk = 'on-track' | 'slipping' | 'at-risk' | 'disengaged'

export interface AdherenceSummary {
  /** 0-1 completion against what was prescribed in the window. */
  score: number
  expectedSessions: number
  completedSessions: number
  /** Consecutive days with at least one completed exercise, ending today. */
  currentStreak: number
  daysSinceLastActivity: number | null
  /** Per-exercise completion, so a therapist can see WHICH thing is skipped. */
  byExercise: Array<{ exerciseId: string; name: string; expected: number; completed: number; score: number }>
  painTrend: 'improving' | 'flat' | 'worsening' | 'unknown'
  risk: AdherenceRisk
  /** One sentence a therapist can act on, not a dashboard tile. */
  recommendation: string
}

export interface SummarizeOptions {
  asOf: ISODate
  windowDays?: number
}

export function summarizeAdherence(
  program: HomeProgram,
  events: AdherenceEvent[],
  { asOf, windowDays = DEFAULT_WINDOW_DAYS }: SummarizeOptions,
): AdherenceSummary {
  const start = addDays(asOf, -(windowDays - 1))
  const windowStart = program.assignedOn > start ? program.assignedOn : start
  const activeDays = daysBetween(windowStart, asOf) + 1
  const weeks = activeDays / 7

  const inWindow = events.filter(
    (e) => e.programId === program.id && e.completedOn >= windowStart && e.completedOn <= asOf,
  )

  const byExercise = program.exercises.map((exercise) => {
    const expected = Math.max(1, Math.round(exercise.prescribedPerWeek * weeks))
    const completed = inWindow.filter((e) => e.exerciseId === exercise.id).length
    return {
      exerciseId: exercise.id,
      name: exercise.name,
      expected,
      completed,
      score: expected === 0 ? 1 : Math.min(1, completed / expected),
    }
  })

  const expectedSessions = byExercise.reduce((sum, e) => sum + e.expected, 0)
  // Cap per exercise before summing — overdoing one cannot cover skipping another.
  const creditedSessions = byExercise.reduce((sum, e) => sum + Math.min(e.completed, e.expected), 0)
  const completedSessions = inWindow.length
  const score = expectedSessions === 0 ? 1 : round3(creditedSessions / expectedSessions)

  const activeDates = new Set(inWindow.map((e) => e.completedOn))
  let currentStreak = 0
  for (let offset = 0; ; offset += 1) {
    const day = addDays(asOf, -offset)
    if (day < windowStart || !activeDates.has(day)) break
    currentStreak += 1
  }

  const allDates = events
    .filter((e) => e.programId === program.id && e.completedOn <= asOf)
    .map((e) => e.completedOn)
    .sort()
  const lastActivity = allDates.at(-1)
  const daysSinceLastActivity = lastActivity ? daysBetween(lastActivity, asOf) : null

  const painTrend = trendOfPain(inWindow)
  const risk = classify(score, daysSinceLastActivity, painTrend)

  return {
    score,
    expectedSessions,
    completedSessions,
    currentStreak,
    daysSinceLastActivity,
    byExercise,
    painTrend,
    risk,
    recommendation: recommend(risk, byExercise, painTrend, daysSinceLastActivity),
  }
}

function classify(
  score: number,
  daysSinceLastActivity: number | null,
  painTrend: AdherenceSummary['painTrend'],
): AdherenceRisk {
  if (daysSinceLastActivity === null || daysSinceLastActivity >= 10) return 'disengaged'
  let risk: AdherenceRisk =
    score >= 0.8 ? 'on-track' : score >= 0.5 ? 'slipping' : 'at-risk'
  if (daysSinceLastActivity >= 5 && risk === 'on-track') risk = 'slipping'
  // Doing the work and hurting more is not "on track".
  if (painTrend === 'worsening' && risk === 'on-track') risk = 'slipping'
  return risk
}

function recommend(
  risk: AdherenceRisk,
  byExercise: AdherenceSummary['byExercise'],
  painTrend: AdherenceSummary['painTrend'],
  daysSinceLastActivity: number | null,
): string {
  const weakest = [...byExercise].sort((a, b) => a.score - b.score)[0]
  if (risk === 'disengaged') {
    return daysSinceLastActivity === null
      ? 'Patient has never logged a session. Confirm they can open the program before the next visit.'
      : `No activity for ${daysSinceLastActivity} days. Call before the next visit — this is the dropout window.`
  }
  if (painTrend === 'worsening') {
    return 'Pain is trending up while the program is being done. Review dosage at or before the next visit.'
  }
  if (risk === 'on-track') return 'Adherence is holding. Progress the program at the next visit.'
  if (weakest && weakest.score < 0.5) {
    return `${weakest.name} is being skipped (${weakest.completed}/${weakest.expected}). Ask what is in the way before adding anything new.`
  }
  return 'Completion is drifting. Shorten the program rather than repeating the instruction.'
}

function trendOfPain(events: AdherenceEvent[]): AdherenceSummary['painTrend'] {
  const scored = events
    .filter((e) => typeof e.painScore === 'number')
    .sort((a, b) => a.completedOn.localeCompare(b.completedOn))
  if (scored.length < 4) return 'unknown'
  const mid = Math.floor(scored.length / 2)
  const first = mean(scored.slice(0, mid).map((e) => e.painScore!))
  const second = mean(scored.slice(mid).map((e) => e.painScore!))
  const delta = second - first
  if (delta <= -0.75) return 'improving'
  if (delta >= 0.75) return 'worsening'
  return 'flat'
}

const mean = (xs: number[]): number => xs.reduce((a, b) => a + b, 0) / xs.length
const round3 = (n: number): number => Math.round(n * 1000) / 1000

export function addDays(date: ISODate, days: number): ISODate {
  const ms = Date.parse(`${date}T00:00:00Z`) + days * 86_400_000
  return new Date(ms).toISOString().slice(0, 10)
}

export function daysBetween(from: ISODate, to: ISODate): number {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000)
}
