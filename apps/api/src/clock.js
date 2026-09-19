/**
 * The clinic's day, not the server's. A visit documented at 6pm Pacific must
 * not land on tomorrow's date because the box runs UTC — that single bug
 * misdates claims, breaks the "visits this week" count, and is invisible until
 * someone reconciles a remittance.
 */
export const CLINIC_TIME_ZONE = process.env.THROUGHLINE_TZ ?? 'America/Los_Angeles'

export function clinicToday(now = new Date()) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: CLINIC_TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(now)
}

export function clinicDateOffset(days, now = new Date()) {
  const base = Date.parse(`${clinicToday(now)}T00:00:00Z`)
  return new Date(base + days * 86_400_000).toISOString().slice(0, 10)
}
