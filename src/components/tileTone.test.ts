import { describe, expect, it } from 'vitest'
import { TILE_TONE_COUNT, tileToneIndex } from './tileTone'

describe('tileToneIndex', () => {
  it('is stable and within 0..5', () => {
    for (const name of ['', 'a', 'すし富山', '麺屋 一灯', 'Café 🍰']) {
      const t = tileToneIndex(name)
      expect(t).toBe(tileToneIndex(name))
      expect(Number.isInteger(t) && t >= 0 && t < TILE_TONE_COUNT).toBe(true)
    }
  })

  it('uses the sum of char codes modulo 6', () => {
    expect(tileToneIndex('a')).toBe(97 % 6)
    expect(tileToneIndex('ab')).toBe((97 + 98) % 6)
  })

  it('spreads different names over several tones', () => {
    const tones = new Set(['いろは', 'かもめ', 'あさひ', 'うお', '麺屋', '鮨', '焼肉', 'Bar'].map(tileToneIndex))
    expect(tones.size).toBeGreaterThan(2)
  })
})
