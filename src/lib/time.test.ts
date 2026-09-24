import { afterEach, describe, expect, it } from 'vitest'
import { nowIso, setClock } from './time'

describe('nowIso', () => {
  afterEach(() => setClock(null))

  it('returns an ISO 8601 UTC string by default', () => {
    expect(nowIso()).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/)
  })

  it('can be replaced and restored', () => {
    setClock(() => '2026-09-24T01:23:45.678Z')
    expect(nowIso()).toBe('2026-09-24T01:23:45.678Z')
    setClock(null)
    expect(nowIso()).not.toBe('2026-09-24T01:23:45.678Z')
  })
})
