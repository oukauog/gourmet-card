import { describe, expect, it } from 'vitest'
import { fitLongSide } from './imageSize'
import { LARGE_IMAGE, SMALL_IMAGE } from './imageSizes'

describe('fitLongSide', () => {
  it('scales landscape images by width', () => {
    expect(fitLongSide(3000, 2000, 1800)).toEqual({ width: 1800, height: 1200 })
    expect(fitLongSide(3000, 2000, 400)).toEqual({ width: 400, height: 267 }) // 266.67 -> 267
  })

  it('scales portrait images by height', () => {
    expect(fitLongSide(3024, 4032, 1800)).toEqual({ width: 1350, height: 1800 })
    expect(fitLongSide(1500, 2000, 1800)).toEqual({ width: 1350, height: 1800 })
    expect(fitLongSide(800, 1200, 400)).toEqual({ width: 267, height: 400 })
  })

  it('scales square images', () => {
    expect(fitLongSide(4000, 4000, 1800)).toEqual({ width: 1800, height: 1800 })
  })

  it('never enlarges smaller images', () => {
    expect(fitLongSide(800, 1200, 1800)).toEqual({ width: 800, height: 1200 })
    expect(fitLongSide(1800, 1000, 1800)).toEqual({ width: 1800, height: 1000 })
    expect(fitLongSide(1, 1, 400)).toEqual({ width: 1, height: 1 })
  })

  it('keeps the short side at least 1px for extreme ratios', () => {
    expect(fitLongSide(6000, 100, 400)).toEqual({ width: 400, height: 7 })
    expect(fitLongSide(6000, 1, 400)).toEqual({ width: 400, height: 1 })
    expect(fitLongSide(1, 6000, 400)).toEqual({ width: 1, height: 400 })
  })

  it('rounds the short side to the nearest integer', () => {
    expect(fitLongSide(1000, 333, 400)).toEqual({ width: 400, height: 133 }) // 133.2
    expect(fitLongSide(1000, 334, 400)).toEqual({ width: 400, height: 134 }) // 133.6
    expect(fitLongSide(4032, 3024, 400)).toEqual({ width: 400, height: 300 })
  })

  it.each([
    [0, 100, 400],
    [100, -1, 400],
    [100.5, 100, 400],
    [100, 100, 0],
    [NaN, 100, 400],
  ])('rejects invalid input (%s, %s, %s)', (w, h, l) => {
    expect(() => fitLongSide(w, h, l)).toThrow(RangeError)
  })

  it('uses the decided output sizes', () => {
    expect(SMALL_IMAGE).toEqual({ longSide: 400, quality: 0.8 })
    expect(LARGE_IMAGE).toEqual({ longSide: 1800, quality: 0.85 })
  })
})
