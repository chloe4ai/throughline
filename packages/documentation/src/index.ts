import type { Note, ServiceLine, Episode, ISODate } from '@throughline/domain'

/**
 * Documentation is where billing errors are born, so Throughline treats the
 * note as the source of truth and DERIVES the claim from it. The therapist
 * never types a unit count; they record what they did and for how long.
 *
 * Everything here is deterministic. The AI layer (see docs/AI_LAYER.md) drafts
 * prose into this structure and is never allowed to produce the minutes.
 */

export function serviceLinesFromNote(note: Note): ServiceLine[] {
  const byCode = new Map<string, ServiceLine>()
  for (const intervention of note.objective.interventions) {
    const existing = byCode.get(intervention.code)
    if (existing) {
      existing.minutes += intervention.minutes
      existing.assistantMinutes = (existing.assistantMinutes ?? 0) + (intervention.assistantMinutes ?? 0)
    } else {
      byCode.set(intervention.code, {
        code: intervention.code,
        minutes: intervention.minutes,
        assistantMinutes: intervention.assistantMinutes ?? 0,
      })
    }
  }
  return [...byCode.values()]
}

export type ComplianceSeverity = 'blocker' | 'warning'

export interface ComplianceFinding {
  rule: string
  severity: ComplianceSeverity
  message: string
}

export interface ComplianceContext {
  note: Note
  episode: Pick<Episode, 'visitsUsed' | 'authorizedVisits' | 'certificationExpires'>
  visitDate: ISODate
  /** Visits since the last progress note; Medicare requires one every 10. */
  visitsSinceProgressNote: number
}

export const PROGRESS_NOTE_INTERVAL = 10

/**
 * A claim should never leave the building with a blocker on it. Warnings are
 * things a biller can override with a reason; blockers are things that get the
 * money taken back later.
 */
export function checkCompliance(ctx: ComplianceContext): ComplianceFinding[] {
  const findings: ComplianceFinding[] = []
  const { note, episode, visitDate, visitsSinceProgressNote } = ctx

  if (!note.signedBy || !note.signedAt) {
    findings.push({ rule: 'signature', severity: 'blocker', message: 'Note is unsigned. An unsigned note is an unbillable note.' })
  }

  if (note.objective.interventions.length === 0) {
    findings.push({ rule: 'objective-empty', severity: 'blocker', message: 'No interventions documented — nothing supports the codes on the claim.' })
  }

  for (const intervention of note.objective.interventions) {
    if (intervention.minutes <= 0) {
      findings.push({ rule: 'zero-minutes', severity: 'blocker', message: `${intervention.code} is documented with no time. Timed codes need minutes.` })
    }
    if ((intervention.assistantMinutes ?? 0) > intervention.minutes) {
      findings.push({ rule: 'assistant-minutes-exceed-total', severity: 'blocker', message: `${intervention.code}: assistant minutes exceed total minutes.` })
    }
  }

  if (visitDate > episode.certificationExpires) {
    findings.push({ rule: 'plan-of-care-expired', severity: 'blocker', message: `Plan of care expired ${episode.certificationExpires}. Re-certify before billing this visit.` })
  } else if (daysBetween(visitDate, episode.certificationExpires) <= 14) {
    findings.push({ rule: 'plan-of-care-expiring', severity: 'warning', message: `Plan of care expires ${episode.certificationExpires}. Schedule re-certification.` })
  }

  if (visitsSinceProgressNote >= PROGRESS_NOTE_INTERVAL) {
    findings.push({ rule: 'progress-note-due', severity: 'blocker', message: `${visitsSinceProgressNote} visits since the last progress note. Medicare requires one every ${PROGRESS_NOTE_INTERVAL}.` })
  } else if (visitsSinceProgressNote === PROGRESS_NOTE_INTERVAL - 1) {
    findings.push({ rule: 'progress-note-next-visit', severity: 'warning', message: 'Progress note is due at the next visit.' })
  }

  if (episode.authorizedVisits != null) {
    const remaining = episode.authorizedVisits - episode.visitsUsed
    if (remaining <= 0) {
      findings.push({ rule: 'authorization-exhausted', severity: 'blocker', message: 'No authorized visits remain. This visit will deny.' })
    } else if (remaining <= 2) {
      findings.push({ rule: 'authorization-low', severity: 'warning', message: `${remaining} authorized visit(s) left. Request more now, not after the denial.` })
    }
  }

  if (note.assessment.trim().length < 20) {
    findings.push({ rule: 'assessment-thin', severity: 'warning', message: 'Assessment is too thin to demonstrate skilled care. This is the section auditors read first.' })
  }

  return findings
}

export function hasBlockers(findings: ComplianceFinding[]): boolean {
  return findings.some((f) => f.severity === 'blocker')
}

function daysBetween(from: ISODate, to: ISODate): number {
  const ms = Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)
  return Math.round(ms / 86_400_000)
}
