import { describe, expect, it } from 'vitest'
import { PREFECTURES } from './prefectures'

describe('PREFECTURES', () => {
  it('has 47 entries without duplicates', () => {
    expect(PREFECTURES).toHaveLength(47)
    expect(new Set(PREFECTURES).size).toBe(47)
  })

  it('is in JIS order (01 北海道 ... 47 沖縄県)', () => {
    expect(PREFECTURES[0]).toBe('北海道')
    expect(PREFECTURES[12]).toBe('東京都') // 13
    expect(PREFECTURES[15]).toBe('富山県') // 16
    expect(PREFECTURES[16]).toBe('石川県') // 17
    expect(PREFECTURES[25]).toBe('京都府') // 26
    expect(PREFECTURES[26]).toBe('大阪府') // 27
    expect(PREFECTURES[46]).toBe('沖縄県')
  })

  it('every name ends with 都/道/府/県', () => {
    for (const p of PREFECTURES) expect(p).toMatch(/[都道府県]$/)
    expect(PREFECTURES.filter((p) => p.endsWith('県'))).toHaveLength(43)
  })
})
