import { describe, expect, it } from 'vitest'
import { formatJst, versionText } from './version'

describe('version text', () => {
  it('Japan time (UTC+9), zero padded, across the date line', () => {
    expect(formatJst('2026-09-27T12:05:00.000Z')).toBe('2026-09-27 21:05')
    expect(formatJst('2026-12-31T15:00:00.000Z')).toBe('2027-01-01 00:00')
    expect(formatJst('2026-01-02T00:09:59.999Z')).toBe('2026-01-02 09:09')
    expect(formatJst('broken')).toBe('')
  })

  it('build: hash and time; dirty tree keeps the +; no git -> unknown', () => {
    expect(versionText({ hash: 'd844c4f', builtAt: '2026-09-27T12:05:00.000Z' })).toBe('版 d844c4f（2026-09-27 21:05）')
    expect(versionText({ hash: 'd844c4f+', builtAt: '2026-09-27T12:05:00.000Z' })).toBe('版 d844c4f+（2026-09-27 21:05）')
    expect(versionText({ hash: 'unknown', builtAt: 'x' })).toBe('版 unknown')
  })

  it('dev server', () => {
    expect(versionText(undefined)).toBe('開発版')
  })
})
