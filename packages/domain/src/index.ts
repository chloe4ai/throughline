/**
 * Shared domain vocabulary for Throughline.
 *
 * Everything the clinic actually talks about lives here: a patient, an episode
 * of care, a visit, the note written about that visit, the home program, and
 * the adherence events that come back from the patient's phone. Billing and
 * adherence are computed FROM these — they never redefine them.
 */

export type ISODate = string // 'YYYY-MM-DD'
export type ISODateTime = string // RFC 3339

export type Discipline = 'PT' | 'OT' | 'SLP'

/** Who physically delivered the minutes. Drives CQ/CO modifiers. */
export type ProviderRole = 'therapist' | 'assistant'

export interface Clinic {
  id: string
  name: string
  /** Place of service code; 11 = office, 12 = home. Affects some payer rules. */
  placeOfService: '11' | '12'
}

export interface Patient {
  id: string
  clinicId: string
  firstName: string
  lastName: string
  dateOfBirth: ISODate
  /** Plan the episode is billed to. */
  payerId: string
  memberId: string
}

/**
 * An episode is the unit clinics actually manage: one referral, one plan of
 * care, one authorization, N visits. Progress notes and re-certification are
 * driven off the visit count within the episode, not off the calendar.
 */
export interface Episode {
  id: string
  patientId: string
  discipline: Discipline
  /** ICD-10 codes on the plan of care. */
  diagnoses: string[]
  startDate: ISODate
  /** Visits authorized by the payer; null when the plan needs no auth. */
  authorizedVisits: number | null
  visitsUsed: number
  /** Plan of care must be re-certified on or before this date. */
  certificationExpires: ISODate
  status: 'active' | 'on-hold' | 'discharged'
}

/** One billable line of work inside a visit. */
export interface ServiceLine {
  /** CPT/HCPCS code, e.g. '97110'. */
  code: string
  /** Minutes of one-on-one time. Omitted/0 for untimed (service-based) codes. */
  minutes: number
  /** Minutes within this line delivered by a PTA/OTA. */
  assistantMinutes?: number
  /** Untimed codes bill one unit regardless of time. */
  untimed?: boolean
}

export interface Visit {
  id: string
  episodeId: string
  date: ISODate
  /** Minutes the patient was in the clinic, for productivity reporting only. */
  durationMinutes?: number
  services: ServiceLine[]
  /** Who led the visit; individual lines can still be assistant-delivered. */
  renderedBy: ProviderRole
  noteId?: string
}

/** Structured SOAP note. The objective section is what billing reads. */
export interface Note {
  id: string
  visitId: string
  subjective: string
  objective: {
    /** Exercises/activities performed, each with its own minutes and code. */
    interventions: Array<{
      code: string
      description: string
      minutes: number
      assistantMinutes?: number
      /** Free text the therapist typed; the AI layer drafts, never invents. */
      detail?: string
    }>
    measures?: Array<{ name: string; value: number; unit: string }>
  }
  assessment: string
  plan: string
  signedBy?: string
  signedAt?: ISODateTime
}

export interface HomeExercise {
  id: string
  name: string
  /** How many times per week the patient is supposed to do it. */
  prescribedPerWeek: number
  sets: number
  reps: number
  videoUrl?: string
}

export interface HomeProgram {
  id: string
  episodeId: string
  assignedOn: ISODate
  exercises: HomeExercise[]
}

export interface AdherenceEvent {
  id: string
  programId: string
  exerciseId: string
  /** When the patient says they did it. */
  completedOn: ISODate
  /** Patient-reported pain 0-10 at the time, if collected. */
  painScore?: number
  source: 'patient-app' | 'sms' | 'clinic-entry'
}

export interface Payer {
  id: string
  name: string
  /** Which units-of-service rule this payer follows. */
  unitRule: 'medicare-8-minute' | 'ama-rule-of-eights'
  /** Does this payer apply MPPR to the practice-expense portion? */
  appliesMppr: boolean
  /** Does this payer honor CQ/CO 15% assistant reduction? */
  appliesAssistantReduction: boolean
  /** Contracted rate as a percentage of the Medicare fee schedule. 1.0 = par. */
  feeScheduleMultiplier: number
}

export interface PatientBenefits {
  /** Dollars of deductible the patient still owes this plan year. */
  deductibleRemaining: number
  /** Patient share after deductible, e.g. 0.2 for 20%. */
  coinsurance: number
  /** Flat per-visit copay, if the plan uses one instead of coinsurance. */
  copay?: number
}
