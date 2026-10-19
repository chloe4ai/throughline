import { queueSnapshot, adherenceSnapshot, patientsSnapshot, payersSnapshot } from './fixtures.js'

/**
 * One fetch helper with a deliberate fallback: if the API is not running (the
 * GitHub Pages build, or a reviewer who cloned and ran only `npm run web`),
 * serve the captured snapshot and say so in the UI rather than showing an
 * error page. A demo that cannot be opened does not get looked at.
 */

export type DataSource = 'live' | 'snapshot'

export interface Loaded<T> {
  data: T
  source: DataSource
}

const BASE = import.meta.env.VITE_API_URL ?? '/api'

/**
 * A production build with no API URL (the GitHub Pages demo) has no server to
 * reach, so it serves the bundled snapshot without firing doomed requests.
 */
const DEMO_MODE = import.meta.env.PROD && !import.meta.env.VITE_API_URL

async function get<T>(path: string, fallback: T): Promise<Loaded<T>> {
  if (DEMO_MODE) return { data: fallback, source: 'snapshot' }
  try {
    const response = await fetch(`${BASE}${path}`, { signal: AbortSignal.timeout(2500) })
    if (!response.ok) throw new Error(String(response.status))
    return { data: (await response.json()) as T, source: 'live' }
  } catch {
    return { data: fallback, source: 'snapshot' }
  }
}

/**
 * The API's response shapes, written out rather than inferred from the
 * snapshot: inferring from a literal gives you the types of THAT data (a
 * note that happens to be unsigned has no signedBy field at all), which
 * type-checks today and breaks the moment the data changes.
 */

import type { VisitPricing } from '@throughline/billing'
import type { Note } from '@throughline/domain'

export interface ComplianceFinding {
  rule: string
  severity: 'blocker' | 'warning'
  message: string
}

export interface QueueItem {
  visitId: string
  date: string
  patient: string
  payer: string
  unitRule: 'medicare-8-minute' | 'ama-rule-of-eights'
  note: Note | null
  services: Array<{ code: string; minutes: number; assistantMinutes?: number }>
  pricing: VisitPricing
  findings: ComplianceFinding[]
  billable: boolean
}

export interface AdherenceRow {
  programId: string
  patient: string
  summary: {
    score: number
    expectedSessions: number
    completedSessions: number
    currentStreak: number
    daysSinceLastActivity: number | null
    byExercise: Array<{ exerciseId: string; name: string; expected: number; completed: number; score: number }>
    painTrend: 'improving' | 'flat' | 'worsening' | 'unknown'
    risk: 'on-track' | 'slipping' | 'at-risk' | 'disengaged'
    recommendation: string
  }
}

export interface PatientRow {
  id: string
  name: string
  payer: string
  episodeId: string
  visitsUsed: number
  authorizedVisits: number | null
  certificationExpires: string
}

export interface PayerRow {
  id: string
  name: string
  unitRule: 'medicare-8-minute' | 'ama-rule-of-eights'
  appliesMppr: boolean
  appliesAssistantReduction: boolean
  feeScheduleMultiplier: number
}

const asQueue = queueSnapshot as unknown as QueueItem[]
const asAdherence = adherenceSnapshot as unknown as AdherenceRow[]
const asPatients = patientsSnapshot as unknown as PatientRow[]
const asPayers = payersSnapshot as unknown as PayerRow[]

export const fetchQueue = () => get<QueueItem[]>('/queue', asQueue)
export const fetchAdherence = () => get<AdherenceRow[]>('/adherence', asAdherence)
export const fetchPatients = () => get<PatientRow[]>('/patients', asPatients)
export const fetchPayers = () => get<PayerRow[]>('/payers', asPayers)

export const money = (n: number) =>
  n.toLocaleString('en-US', { style: 'currency', currency: 'USD' })

export const percent = (n: number) => `${Math.round(n * 100)}%`
