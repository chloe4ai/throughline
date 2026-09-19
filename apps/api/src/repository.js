/** Row -> domain object mapping, kept in one place so the routes stay thin. */

export function toPayer(row) {
  return {
    id: row.id,
    name: row.name,
    unitRule: row.unit_rule,
    appliesMppr: !!row.applies_mppr,
    appliesAssistantReduction: !!row.applies_assistant_reduction,
    feeScheduleMultiplier: row.fee_schedule_multiplier,
  }
}

export function toBenefits(row) {
  return {
    deductibleRemaining: row.deductible_remaining,
    coinsurance: row.coinsurance,
    ...(row.copay != null ? { copay: row.copay } : {}),
  }
}

export function toEpisode(row) {
  return {
    id: row.id,
    patientId: row.patient_id,
    discipline: row.discipline,
    diagnoses: JSON.parse(row.diagnoses),
    startDate: row.start_date,
    authorizedVisits: row.authorized_visits,
    visitsUsed: row.visits_used,
    certificationExpires: row.certification_expires,
    status: row.status,
  }
}

export function toNote(row) {
  return {
    id: row.id,
    visitId: row.visit_id,
    subjective: row.subjective,
    objective: JSON.parse(row.objective),
    assessment: row.assessment,
    plan: row.plan,
    signedBy: row.signed_by ?? undefined,
    signedAt: row.signed_at ?? undefined,
  }
}

export function toProgram(row) {
  return {
    id: row.id,
    episodeId: row.episode_id,
    assignedOn: row.assigned_on,
    exercises: JSON.parse(row.exercises),
  }
}

export function toAdherenceEvent(row) {
  return {
    id: row.id,
    programId: row.program_id,
    exerciseId: row.exercise_id,
    completedOn: row.completed_on,
    painScore: row.pain_score ?? undefined,
    source: row.source,
  }
}

/** Everything one visit needs to be priced and compliance-checked. */
export function loadVisitContext(db, visitId) {
  const visit = db.prepare('SELECT * FROM visits WHERE id = ?').get(visitId)
  if (!visit) return null
  const episode = toEpisode(db.prepare('SELECT * FROM episodes WHERE id = ?').get(visit.episode_id))
  const patientRow = db.prepare('SELECT * FROM patients WHERE id = ?').get(episode.patientId)
  const payer = toPayer(db.prepare('SELECT * FROM payers WHERE id = ?').get(patientRow.payer_id))
  const noteRow = db.prepare('SELECT * FROM notes WHERE visit_id = ?').get(visitId)

  return {
    visit: {
      id: visit.id,
      episodeId: visit.episode_id,
      date: visit.date,
      renderedBy: visit.rendered_by,
      visitsSinceProgressNote: visit.visits_since_progress_note,
      status: visit.status,
    },
    episode,
    patient: {
      id: patientRow.id,
      firstName: patientRow.first_name,
      lastName: patientRow.last_name,
      dateOfBirth: patientRow.date_of_birth,
      payerId: patientRow.payer_id,
      memberId: patientRow.member_id,
    },
    payer,
    benefits: toBenefits(patientRow),
    note: noteRow ? toNote(noteRow) : null,
  }
}
