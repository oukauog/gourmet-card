import { afterEach, describe, expect, it, vi } from 'vitest'
import { newId, uuidV4FromRandomValues } from './id'

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/

describe('uuidV4FromRandomValues', () => {
  it('returns RFC 4122 v4 format', () => {
    for (let i = 0; i < 100; i++) expect(uuidV4FromRandomValues()).toMatch(UUID_V4)
  })

  it('has no duplicates in 1000 ids', () => {
    const ids = new Set(Array.from({ length: 1000 }, () => uuidV4FromRandomValues()))
    expect(ids.size).toBe(1000)
  })

  it('sets version and variant bits even for all-0xff / all-0x00 random bytes', () => {
    for (const fill of [0xff, 0x00]) {
      const fake = (a: Uint8Array) => a.fill(fill)
      const spy = vi
        .spyOn(crypto, 'getRandomValues')
        .mockImplementation(fake as unknown as typeof crypto.getRandomValues)
      try {
        const id = uuidV4FromRandomValues()
        expect(id).toMatch(UUID_V4)
        expect(id).toBe(fill ? 'ffffffff-ffff-4fff-bfff-ffffffffffff' : '00000000-0000-4000-8000-000000000000')
      } finally {
        spy.mockRestore()
      }
    }
  })
})

describe('newId', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('uses crypto.randomUUID when available', () => {
    expect(typeof crypto.randomUUID).toBe('function')
    expect(newId()).toMatch(UUID_V4)
  })

  it('falls back when crypto.randomUUID is missing (non-secure context, e.g. http://192.168.x.x)', () => {
    const real = globalThis.crypto
    vi.stubGlobal('crypto', { getRandomValues: real.getRandomValues.bind(real), randomUUID: undefined })
    expect(crypto.randomUUID).toBeUndefined()
    const ids = new Set(Array.from({ length: 100 }, () => newId()))
    expect(ids.size).toBe(100)
    for (const id of ids) expect(id).toMatch(UUID_V4)
  })

  it('restores crypto after the stub', () => {
    expect(typeof crypto.randomUUID).toBe('function')
  })
})
