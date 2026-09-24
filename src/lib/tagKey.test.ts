import { describe, expect, it } from 'vitest'
import { normalizeTagKey } from './tagKey'

describe('normalizeTagKey', () => {
  it('treats full-width and half-width alphanumerics as the same', () => {
    expect(normalizeTagKey('ＢＡＲ１２３')).toBe(normalizeTagKey('BAR123'))
    expect(normalizeTagKey('ＢＡＲ１２３')).toBe('bar123')
  })

  it('treats half-width and full-width katakana as the same', () => {
    expect(normalizeTagKey('ﾗｰﾒﾝ')).toBe(normalizeTagKey('ラーメン'))
    expect(normalizeTagKey('ｶﾞｽﾄﾛ')).toBe(normalizeTagKey('ガストロ'))
    expect(normalizeTagKey('ﾗｰﾒﾝ')).toBe('ラーメン')
  })

  it('treats upper and lower case as the same', () => {
    expect(normalizeTagKey('Sushi')).toBe('sushi')
    expect(normalizeTagKey('SUSHI')).toBe(normalizeTagKey('sushi'))
    expect(normalizeTagKey('ｓｕｓｈｉ')).toBe('sushi')
  })

  it('trims and collapses spaces (including full-width spaces)', () => {
    expect(normalizeTagKey('  国道8号沿い  ')).toBe('国道8号沿い')
    expect(normalizeTagKey('国道  8号\t沿い')).toBe('国道 8号 沿い')
    expect(normalizeTagKey('　国道　　8号　')).toBe('国道 8号')
  })

  it('keeps Japanese text and does NOT merge hiragana with katakana', () => {
    expect(normalizeTagKey('総曲輪')).toBe('総曲輪')
    expect(normalizeTagKey('らーめん')).not.toBe(normalizeTagKey('ラーメン'))
    expect(normalizeTagKey('らーめん')).toBe('らーめん')
  })

  it('returns empty string for blank input', () => {
    expect(normalizeTagKey('   ')).toBe('')
    expect(normalizeTagKey('')).toBe('')
  })
})
