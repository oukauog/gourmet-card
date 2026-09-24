// Current time as an ISO 8601 UTC string (e.g. 2026-09-24T01:23:45.678Z).
// The clock can be replaced in tests via setClock().

export type Clock = () => string

const systemClock: Clock = () => new Date().toISOString()

let clock: Clock = systemClock

export function nowIso(): string {
  return clock()
}

/** Replace the clock (tests). Pass null to restore the system clock. */
export function setClock(next: Clock | null): void {
  clock = next ?? systemClock
}
