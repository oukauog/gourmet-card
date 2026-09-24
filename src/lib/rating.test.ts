import { describe, expect, it } from 'vitest'
import { isValidRating, ratingFromNumber, ratingToText, starFills } from './rating'

describe('isValidRating', () => {
  it('accepts every integer 1..50', () => {
    for (let r = 1; r <= 50; r++) expect(isValidRating(r)).toBe(true)
  })

  it.each([0, 51, -1, 3.7, 37.5, NaN, Infinity, '37', null, undefined])('rejects %s', (v) => {
    expect(isValidRating(v)).toBe(false)
  })
})

describe('ratingToText / ratingFromNumber', () => {
  it('round-trips for all values 1..50', () => {
    for (let r = 1; r <= 50; r++) {
      const text = ratingToText(r)
      expect(text).toMatch(/^\d\.\d$/)
      expect(ratingFromNumber(Number(text))).toBe(r)
    }
  })

  it('formats with exactly one decimal place', () => {
    expect(ratingToText(37)).toBe('3.7')
    expect(ratingToText(50)).toBe('5.0')
    expect(ratingToText(1)).toBe('0.1')
    expect(ratingToText(10)).toBe('1.0')
  })

  it('shows 未評価 for undefined', () => {
    expect(ratingToText(undefined)).toBe('未評価')
  })

  it('throws for invalid stored values', () => {
    expect(() => ratingToText(0)).toThrow(RangeError)
    expect(() => ratingToText(51)).toThrow(RangeError)
    expect(() => ratingToText(3.7)).toThrow(RangeError)
  })

  it('absorbs float error', () => {
    // the float problem this guards against (e.g. slider value built by adding 0.1 steps)
    expect((0.1 + 0.2) * 10).not.toBe(3)
    expect((0.7 + 0.1) * 10).not.toBe(8)
    expect(ratingFromNumber(0.7 + 0.1)).toBe(8)
    expect(ratingFromNumber(3.7)).toBe(37)
    expect(ratingFromNumber(0.1 + 0.2)).toBe(3)
    expect(ratingFromNumber(5)).toBe(50)
  })

  it.each([0, 5.1, -0.1, 3.75, NaN, Infinity])('ratingFromNumber rejects %s', (v) => {
    expect(() => ratingFromNumber(v)).toThrow(RangeError)
  })
})

describe('starFills', () => {
  it('fills proportionally', () => {
    expect(starFills(37)).toEqual([1, 1, 1, 0.7, 0])
    expect(starFills(50)).toEqual([1, 1, 1, 1, 1])
    expect(starFills(1)).toEqual([0.1, 0, 0, 0, 0])
    expect(starFills(10)).toEqual([1, 0, 0, 0, 0])
    expect(starFills(49)).toEqual([1, 1, 1, 1, 0.9])
  })

  it('returns all zero for unrated', () => {
    expect(starFills(undefined)).toEqual([0, 0, 0, 0, 0])
  })

  it('always has 5 values in 0..1 whose sum equals rating / 10', () => {
    for (let r = 1; r <= 50; r++) {
      const fills = starFills(r)
      expect(fills).toHaveLength(5)
      fills.forEach((f) => expect(f >= 0 && f <= 1).toBe(true))
      expect(fills.reduce((a, b) => a + b, 0)).toBeCloseTo(r / 10, 10)
    }
  })

  it('throws for invalid values', () => {
    expect(() => starFills(0)).toThrow(RangeError)
    expect(() => starFills(51)).toThrow(RangeError)
  })
})
