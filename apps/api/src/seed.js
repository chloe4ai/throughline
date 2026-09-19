/**
 * A small but not toy clinic: four patients spanning the cases that actually
 * differ — a Medicare patient with an assistant-heavy visit, a commercial
 * patient on the AMA rule, an evaluation visit, and a patient who has gone
 * quiet on their home program.
 */

import { clinicDateOffset } from './clock.js'

const iso = (offsetDays = 0) => clinicDateOffset(offsetDays)

export function seed(db) {
  const payers = [
    ['medicare', 'Medicare Part B', 'medicare-8-minute', 1, 1, 1.0],
    ['bcbs-ppo', 'Blue Shield PPO', 'ama-rule-of-eights', 0, 0, 1.35],
    ['united', 'UnitedHealthcare', 'medicare-8-minute', 1, 1, 1.12],
  ]
  const insertPayer = db.prepare(
    'INSERT INTO payers (id,name,unit_rule,applies_mppr,applies_assistant_reduction,fee_schedule_multiplier) VALUES (?,?,?,?,?,?)',
  )
  for (const p of payers) insertPayer.run(...p)

  const patients = [
    ['pt-1', 'Miriam', 'Okonkwo', '1949-04-02', 'medicare', 'MED-88213', 0, 0.2, null],
    ['pt-2', 'Daniel', 'Reyes', '1988-11-17', 'bcbs-ppo', 'BS-4410932', 420, 0.2, null],
    ['pt-3', 'Aisha', 'Farouk', '1975-06-30', 'united', 'UHC-77214', 0, 0, 35],
    ['pt-4', 'Tom', 'Bradley', '1962-01-09', 'medicare', 'MED-55190', 0, 0.2, null],
  ]
  const insertPatient = db.prepare(
    'INSERT INTO patients (id,first_name,last_name,date_of_birth,payer_id,member_id,deductible_remaining,coinsurance,copay) VALUES (?,?,?,?,?,?,?,?,?)',
  )
  for (const p of patients) insertPatient.run(...p)

  const episodes = [
    ['ep-1', 'pt-1', 'PT', JSON.stringify(['M17.11']), iso(-40), null, 8, iso(20), 'active'],
    ['ep-2', 'pt-2', 'PT', JSON.stringify(['M54.5']), iso(-21), 12, 10, iso(45), 'active'],
    ['ep-3', 'pt-3', 'PT', JSON.stringify(['S83.511A']), iso(-3), 20, 1, iso(85), 'active'],
    ['ep-4', 'pt-4', 'PT', JSON.stringify(['M25.511']), iso(-60), 24, 19, iso(9), 'active'],
  ]
  const insertEpisode = db.prepare(
    'INSERT INTO episodes (id,patient_id,discipline,diagnoses,start_date,authorized_visits,visits_used,certification_expires,status) VALUES (?,?,?,?,?,?,?,?,?)',
  )
  for (const e of episodes) insertEpisode.run(...e)

  const visits = [
    ['v-1', 'ep-1', iso(-1), 'assistant', 4, 'documented'],
    ['v-2', 'ep-2', iso(-1), 'therapist', 9, 'documented'],
    ['v-3', 'ep-3', iso(-2), 'therapist', 1, 'documented'],
    ['v-4', 'ep-4', iso(0), 'therapist', 10, 'documented'],
  ]
  const insertVisit = db.prepare(
    'INSERT INTO visits (id,episode_id,date,rendered_by,visits_since_progress_note,status) VALUES (?,?,?,?,?,?)',
  )
  for (const v of visits) insertVisit.run(...v)

  const notes = [
    ['n-1', 'v-1', 'Right knee stiff on waking, 4/10.', {
      interventions: [
        { code: '97110', description: 'Quad sets, heel slides, SLR', minutes: 22, assistantMinutes: 22 },
        { code: '97140', description: 'Patellar mobilization grade II', minutes: 13, assistantMinutes: 0 },
      ],
      measures: [{ name: 'Knee flexion AROM', value: 112, unit: 'deg' }],
    }, 'Quad activation improving; PTA delivered the exercise portion in full.', 'Progress to step-downs; therapist to reassess ROM next visit.', 'C. Tan, PT', new Date().toISOString()],

    ['n-2', 'v-2', 'Lower back tight after desk work, 3/10.', {
      interventions: [
        { code: '97110', description: 'Core endurance progression', minutes: 20 },
        { code: '97140', description: 'Lumbar joint mobilization', minutes: 20 },
      ],
    }, 'Tolerating extension bias without peripheralization. Commercial plan bills on the AMA rule, so this visit is two units rather than three.', 'Continue; re-evaluate at visit 12.', 'C. Tan, PT', new Date().toISOString()],

    ['n-3', 'v-3', 'New ACL referral, post-op week 3.', {
      interventions: [{ code: '97162', description: 'PT evaluation, moderate complexity', minutes: 45 }],
    }, 'Moderate-complexity evaluation; effusion present, ROM limited.', 'Initiate plan of care, 2x/week for 8 weeks.', 'C. Tan, PT', new Date().toISOString()],

    ['n-4', 'v-4', 'Shoulder improving, 2/10 with overhead reach.', {
      interventions: [
        { code: '97110', description: 'Scapular stabilization', minutes: 18 },
        { code: '97530', description: 'Overhead lifting simulation', minutes: 17 },
        { code: '97012', description: 'Mechanical traction', minutes: 10 },
      ],
    }, 'Ready to progress load.', 'Continue weekly.', null, null],
  ]
  const insertNote = db.prepare(
    'INSERT INTO notes (id,visit_id,subjective,objective,assessment,plan,signed_by,signed_at) VALUES (?,?,?,?,?,?,?,?)',
  )
  for (const [id, visitId, subjective, objective, assessment, plan, signedBy, signedAt] of notes) {
    insertNote.run(id, visitId, subjective, JSON.stringify(objective), assessment, plan, signedBy, signedAt)
  }

  const programs = [
    ['hp-1', 'ep-1', iso(-35), [
      { id: 'quad-sets', name: 'Quad sets', prescribedPerWeek: 7, sets: 3, reps: 10 },
      { id: 'heel-slides', name: 'Heel slides', prescribedPerWeek: 7, sets: 3, reps: 10 },
    ]],
    ['hp-2', 'ep-2', iso(-18), [
      { id: 'dead-bug', name: 'Dead bug', prescribedPerWeek: 5, sets: 3, reps: 8 },
      { id: 'hip-hinge', name: 'Hip hinge drill', prescribedPerWeek: 5, sets: 3, reps: 10 },
    ]],
    ['hp-4', 'ep-4', iso(-50), [
      { id: 'pendulum', name: 'Pendulum swings', prescribedPerWeek: 7, sets: 2, reps: 15 },
      { id: 'wall-slides', name: 'Wall slides', prescribedPerWeek: 5, sets: 3, reps: 10 },
    ]],
  ]
  const insertProgram = db.prepare('INSERT INTO home_programs (id,episode_id,assigned_on,exercises) VALUES (?,?,?,?)')
  for (const [id, episodeId, assignedOn, exercises] of programs) {
    insertProgram.run(id, episodeId, assignedOn, JSON.stringify(exercises))
  }

  const insertEvent = db.prepare(
    'INSERT INTO adherence_events (id,program_id,exercise_id,completed_on,pain_score,source) VALUES (?,?,?,?,?,?)',
  )
  let n = 0
  // hp-1: adherent, pain improving.
  for (let d = 0; d < 14; d += 1) {
    for (const ex of ['quad-sets', 'heel-slides']) {
      insertEvent.run(`ae-${n++}`, 'hp-1', ex, iso(-d), Math.min(6, 1.5 + d * 0.18), 'patient-app')
    }
  }
  // hp-2: does the easy one, skips the hard one.
  for (let d = 0; d < 14; d += 2) {
    insertEvent.run(`ae-${n++}`, 'hp-2', 'dead-bug', iso(-d), null, 'patient-app')
  }
  // hp-4: went quiet twelve days ago.
  for (let d = 12; d < 20; d += 1) {
    insertEvent.run(`ae-${n++}`, 'hp-4', 'pendulum', iso(-d), null, 'sms')
  }
}
