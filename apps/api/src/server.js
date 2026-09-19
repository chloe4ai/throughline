import { createServer } from 'node:http'
import { priceVisit } from '@throughline/billing'
import { serviceLinesFromNote, checkCompliance, hasBlockers } from '@throughline/documentation'
import { summarizeAdherence } from '@throughline/adherence'
import { openDatabase } from './db.js'
import { loadVisitContext, toProgram, toAdherenceEvent, toEpisode } from './repository.js'
import { clinicToday } from './clock.js'

/**
 * A deliberately small HTTP layer over node's built-in server. There is no
 * framework here because there is nothing yet for a framework to do: the value
 * is in the packages, and every route below is a thin composition of them.
 * When auth, validation and rate limiting arrive, this becomes Fastify.
 */

const db = openDatabase(process.env.THROUGHLINE_DB ?? 'data/throughline.db')
const PORT = Number(process.env.PORT ?? 8787)
const today = clinicToday

const routes = {
  'GET /api/health': () => ({ ok: true, now: new Date().toISOString() }),

  'GET /api/patients': () => {
    const rows = db.prepare(`
      SELECT p.*, e.id AS episode_id, e.visits_used, e.authorized_visits, e.certification_expires, y.name AS payer_name
      FROM patients p
      JOIN episodes e ON e.patient_id = p.id
      JOIN payers y ON y.id = p.payer_id
      ORDER BY p.last_name
    `).all()
    return rows.map((r) => ({
      id: r.id,
      name: `${r.first_name} ${r.last_name}`,
      payer: r.payer_name,
      episodeId: r.episode_id,
      visitsUsed: r.visits_used,
      authorizedVisits: r.authorized_visits,
      certificationExpires: r.certification_expires,
    }))
  },

  /**
   * The billing queue: every documented visit, priced, with the reasons it
   * would be held. This is the screen a clinic's biller lives in.
   */
  'GET /api/queue': () => {
    const visitIds = db.prepare("SELECT id FROM visits WHERE status = 'documented' ORDER BY date DESC").all()
    return visitIds.map(({ id }) => buildQueueItem(id)).filter(Boolean)
  },

  'GET /api/visits/:id': ({ params }) => buildQueueItem(params.id) ?? notFound('visit'),

  /** Price arbitrary minutes without saving anything — the what-if tool. */
  'POST /api/price': ({ body }) => {
    const payerRow = db.prepare('SELECT * FROM payers WHERE id = ?').get(body.payerId ?? 'medicare')
    if (!payerRow) return notFound('payer')
    const payer = {
      id: payerRow.id, name: payerRow.name, unitRule: payerRow.unit_rule,
      appliesMppr: !!payerRow.applies_mppr,
      appliesAssistantReduction: !!payerRow.applies_assistant_reduction,
      feeScheduleMultiplier: payerRow.fee_schedule_multiplier,
    }
    return priceVisit({
      services: body.services ?? [],
      payer,
      benefits: body.benefits ?? { deductibleRemaining: 0, coinsurance: 0.2 },
      discipline: body.discipline ?? 'PT',
    })
  },

  'GET /api/adherence': () => {
    const programs = db.prepare('SELECT * FROM home_programs').all().map(toProgram)
    return programs.map((program) => {
      const events = db
        .prepare('SELECT * FROM adherence_events WHERE program_id = ?')
        .all(program.id)
        .map(toAdherenceEvent)
      const episode = toEpisode(db.prepare('SELECT * FROM episodes WHERE id = ?').get(program.episodeId))
      const patient = db.prepare('SELECT first_name, last_name FROM patients WHERE id = ?').get(episode.patientId)
      return {
        programId: program.id,
        patient: `${patient.first_name} ${patient.last_name}`,
        summary: summarizeAdherence(program, events, { asOf: today() }),
      }
    })
  },

  'GET /api/payers': () => db.prepare('SELECT * FROM payers').all().map((r) => ({
    id: r.id, name: r.name, unitRule: r.unit_rule,
    appliesMppr: !!r.applies_mppr,
    appliesAssistantReduction: !!r.applies_assistant_reduction,
    feeScheduleMultiplier: r.fee_schedule_multiplier,
  })),
}

function buildQueueItem(visitId) {
  const ctx = loadVisitContext(db, visitId)
  if (!ctx) return null
  const services = ctx.note ? serviceLinesFromNote(ctx.note) : []
  const pricing = priceVisit({
    services, payer: ctx.payer, benefits: ctx.benefits, discipline: ctx.episode.discipline,
  })
  const findings = ctx.note
    ? checkCompliance({
        note: ctx.note,
        episode: ctx.episode,
        visitDate: ctx.visit.date,
        visitsSinceProgressNote: ctx.visit.visitsSinceProgressNote,
      })
    : [{ rule: 'note-missing', severity: 'blocker', message: 'No note exists for this visit.' }]

  return {
    visitId,
    date: ctx.visit.date,
    patient: `${ctx.patient.firstName} ${ctx.patient.lastName}`,
    payer: ctx.payer.name,
    unitRule: ctx.payer.unitRule,
    note: ctx.note,
    services,
    pricing,
    findings,
    billable: !hasBlockers(findings) && pricing.netAllowed > 0,
  }
}

const notFound = (what) => ({ error: `${what} not found`, status: 404 })

const server = createServer(async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Headers', 'content-type')
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS')
  if (req.method === 'OPTIONS') return void res.writeHead(204).end()

  const url = new URL(req.url, `http://${req.headers.host}`)
  const match = resolve(req.method, url.pathname)
  if (!match) return void send(res, 404, { error: 'No such route', path: url.pathname })

  try {
    const body = req.method === 'POST' ? await readJson(req) : undefined
    const result = await match.handler({ params: match.params, query: url.searchParams, body })
    if (result && result.status === 404) return void send(res, 404, result)
    send(res, 200, result)
  } catch (error) {
    send(res, 400, { error: error.message })
  }
})

function resolve(method, pathname) {
  for (const [key, handler] of Object.entries(routes)) {
    const [routeMethod, pattern] = key.split(' ')
    if (routeMethod !== method) continue
    const patternParts = pattern.split('/')
    const pathParts = pathname.replace(/\/$/, '').split('/')
    if (patternParts.length !== pathParts.length) continue
    const params = {}
    const matched = patternParts.every((part, i) => {
      if (part.startsWith(':')) { params[part.slice(1)] = decodeURIComponent(pathParts[i]); return true }
      return part === pathParts[i]
    })
    if (matched) return { handler, params }
  }
  return null
}

function readJson(req) {
  return new Promise((resolve, reject) => {
    let raw = ''
    req.on('data', (chunk) => { raw += chunk })
    req.on('error', reject)
    req.on('end', () => {
      if (!raw) return resolve({})
      try { resolve(JSON.parse(raw)) } catch { reject(new Error('Request body is not valid JSON')) }
    })
  })
}

function send(res, status, payload) {
  const json = JSON.stringify(payload, null, 2)
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8' })
  res.end(json)
}

server.listen(PORT, () => {
  console.log(`Throughline API on http://localhost:${PORT}`)
})
