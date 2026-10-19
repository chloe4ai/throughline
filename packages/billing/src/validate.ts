import type { ServiceLine } from '@throughline/domain'

/**
 * Reject service lines the engine cannot price honestly. Minutes are the input
 * every dollar is derived from, so a string, a negative number or assistant
 * time exceeding the line's own time is an error, not something to coerce.
 */
export function validateServices(lines: unknown): asserts lines is ServiceLine[] {
  if (!Array.isArray(lines)) {
    throw new Error('services must be an array of service lines.')
  }
  lines.forEach((line: unknown, index) => {
    const where = `services[${index}]`
    if (line === null || typeof line !== 'object') {
      throw new Error(`${where} must be an object with a code and minutes.`)
    }
    const { code, minutes, assistantMinutes } = line as Record<string, unknown>
    if (typeof code !== 'string' || code.length === 0) {
      throw new Error(`${where}.code must be a non-empty string.`)
    }
    if (typeof minutes !== 'number' || !Number.isFinite(minutes) || minutes < 0) {
      throw new Error(`${where} (${code}): minutes must be a finite, non-negative number; got ${JSON.stringify(minutes)}.`)
    }
    if (assistantMinutes !== undefined && assistantMinutes !== null) {
      if (typeof assistantMinutes !== 'number' || !Number.isFinite(assistantMinutes) || assistantMinutes < 0) {
        throw new Error(`${where} (${code}): assistantMinutes must be a finite, non-negative number; got ${JSON.stringify(assistantMinutes)}.`)
      }
      if (assistantMinutes > minutes) {
        throw new Error(`${where} (${code}): assistantMinutes (${assistantMinutes}) cannot exceed minutes (${minutes}).`)
      }
    }
  })
}
