import { describe, expect, it } from 'vitest'
import { clampRating, ratingFromSlider, stepRating, UNRATED_START } from './ratingInput'
import { isValidRating } from './rating'

describe('clampRating', () => {
  it('keeps 1..50 integers as they are', () => {
    expect(clampRating(1)).toBe(1)
    expect(clampRating(37)).toBe(37)
    expect(clampRating(50)).toBe(50)
  })

  it('rounds and clamps', () => {
    expect(clampRating(36.6)).toBe(37)
    expect(clampRating(0)).toBe(1)
    expect(clampRating(-5)).toBe(1)
    expect(clampRating(51)).toBe(50)
    expect(clampRating(999)).toBe(50)
  })

  it('never returns an invalid rating', () => {
    for (const v of [Number.NaN, Infinity, -Infinity]) expect(clampRating(v)).toBe(UNRATED_START)
    for (let v = -3; v <= 55; v += 0.25) expect(isValidRating(clampRating(v))).toBe(true)
  })
})

describe('stepRating', () => {
  it('starts from 3.0 when not rated', () => {
    expect(UNRATED_START).toBe(30)
    expect(stepRating(undefined, +1)).toBe(31)
    expect(stepRating(undefined, -1)).toBe(29)
  })

  it('moves by 0.1', () => {
    expect(stepRating(37, +1)).toBe(38)
    expect(stepRating(37, -1)).toBe(36)
  })

  it('stops at 0.1 and 5.0', () => {
    expect(stepRating(1, -1)).toBe(1)
    expect(stepRating(50, +1)).toBe(50)
  })
})

describe('ratingFromSlider', () => {
  it('reads the slider value', () => {
    expect(ratingFromSlider('37')).toBe(37)
    expect(ratingFromSlider(12)).toBe(12)
  })

  it('stays valid for odd input', () => {
    expect(ratingFromSlider('0')).toBe(1)
    expect(ratingFromSlider('60')).toBe(50)
    expect(ratingFromSlider('')).toBe(1) // Number('') is 0
    expect(ratingFromSlider('abc')).toBe(UNRATED_START)
  })
})
