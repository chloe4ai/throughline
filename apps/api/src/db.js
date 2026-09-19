import { DatabaseSync } from 'node:sqlite'
import { mkdirSync } from 'node:fs'
import { dirname } from 'node:path'
import { seed } from './seed.js'

/**
 * SQLite via node's built-in driver: real persistence, zero native deps, and
 * the same SQL a Postgres migration will start from. The schema is written
 * out longhand rather than through an ORM because the interesting constraints
 * here (a note belongs to exactly one visit; an episode owns its visits) are
 * the product, and burying them in decorators hides them.
 */

export function openDatabase(file = 'data/throughline.db') {
  if (file !== ':memory:') mkdirSync(dirname(file), { recursive: true })
  const db = new DatabaseSync(file)
  db.exec('PRAGMA foreign_keys = ON')
  migrate(db)
  if (isEmpty(db)) seed(db)
  return db
}

function migrate(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS payers (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      unit_rule TEXT NOT NULL CHECK (unit_rule IN ('medicare-8-minute','ama-rule-of-eights')),
      applies_mppr INTEGER NOT NULL,
      applies_assistant_reduction INTEGER NOT NULL,
      fee_schedule_multiplier REAL NOT NULL
    );

    CREATE TABLE IF NOT EXISTS patients (
      id TEXT PRIMARY KEY,
      first_name TEXT NOT NULL,
      last_name TEXT NOT NULL,
      date_of_birth TEXT NOT NULL,
      payer_id TEXT NOT NULL REFERENCES payers(id),
      member_id TEXT NOT NULL,
      deductible_remaining REAL NOT NULL DEFAULT 0,
      coinsurance REAL NOT NULL DEFAULT 0.2,
      copay REAL
    );

    CREATE TABLE IF NOT EXISTS episodes (
      id TEXT PRIMARY KEY,
      patient_id TEXT NOT NULL REFERENCES patients(id),
      discipline TEXT NOT NULL,
      diagnoses TEXT NOT NULL,
      start_date TEXT NOT NULL,
      authorized_visits INTEGER,
      visits_used INTEGER NOT NULL DEFAULT 0,
      certification_expires TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'active'
    );

    CREATE TABLE IF NOT EXISTS visits (
      id TEXT PRIMARY KEY,
      episode_id TEXT NOT NULL REFERENCES episodes(id),
      date TEXT NOT NULL,
      rendered_by TEXT NOT NULL,
      visits_since_progress_note INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'documented'
    );

    CREATE TABLE IF NOT EXISTS notes (
      id TEXT PRIMARY KEY,
      visit_id TEXT NOT NULL UNIQUE REFERENCES visits(id),
      subjective TEXT NOT NULL DEFAULT '',
      objective TEXT NOT NULL,
      assessment TEXT NOT NULL DEFAULT '',
      plan TEXT NOT NULL DEFAULT '',
      signed_by TEXT,
      signed_at TEXT
    );

    CREATE TABLE IF NOT EXISTS home_programs (
      id TEXT PRIMARY KEY,
      episode_id TEXT NOT NULL REFERENCES episodes(id),
      assigned_on TEXT NOT NULL,
      exercises TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS adherence_events (
      id TEXT PRIMARY KEY,
      program_id TEXT NOT NULL REFERENCES home_programs(id),
      exercise_id TEXT NOT NULL,
      completed_on TEXT NOT NULL,
      pain_score REAL,
      source TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_visits_episode ON visits(episode_id);
    CREATE INDEX IF NOT EXISTS idx_events_program_date ON adherence_events(program_id, completed_on);
  `)
}

function isEmpty(db) {
  return db.prepare('SELECT COUNT(*) AS n FROM patients').get().n === 0
}
