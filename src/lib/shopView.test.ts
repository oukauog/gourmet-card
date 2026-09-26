import { describe, expect, it } from 'vitest'
import { formatPlace, isOpenableUrl, slideIndexFromScroll } from './shopView'

describe('isOpenableUrl', () => {
  it('accepts http and https URLs', () => {
    expect(isOpenableUrl('https://www.google.com/maps/search/?api=1&query=%E5%AF%8C%E5%B1%B1')).toBe(true)
    expect(isOpenableUrl('http://maps.app.goo.gl/abc')).toBe(true)
    expect(isOpenableUrl('HTTPS://example.com')).toBe(true)
  })

  it('ignores surrounding spaces', () => {
    expect(isOpenableUrl('  https://maps.app.goo.gl/abc \n')).toBe(true)
  })

  it('rejects other schemes', () => {
    expect(isOpenableUrl('javascript:alert(1)')).toBe(false)
    expect(isOpenableUrl(' JavaScript:alert(1)')).toBe(false)
    expect(isOpenableUrl('data:text/html,<b>x</b>')).toBe(false)
    expect(isOpenableUrl('ftp://example.com/a')).toBe(false)
    expect(isOpenableUrl('mailto:a@example.com')).toBe(false)
  })

  it('rejects blank, missing and broken strings', () => {
    expect(isOpenableUrl(undefined)).toBe(false)
    expect(isOpenableUrl('')).toBe(false)
    expect(isOpenableUrl('   ')).toBe(false)
    expect(isOpenableUrl('maps.google.com/xyz')).toBe(false)
    expect(isOpenableUrl('https://')).toBe(false)
    expect(isOpenableUrl('富山のラーメン')).toBe(false)
  })
})

describe('slideIndexFromScroll', () => {
  it('rounds to the nearest slide', () => {
    expect(slideIndexFromScroll(0, 390, 3)).toBe(0)
    expect(slideIndexFromScroll(194, 390, 3)).toBe(0)
    expect(slideIndexFromScroll(196, 390, 3)).toBe(1)
    expect(slideIndexFromScroll(390, 390, 3)).toBe(1)
    expect(slideIndexFromScroll(779.5, 390, 3)).toBe(2)
  })

  it('clamps to 0..count-1', () => {
    expect(slideIndexFromScroll(-50, 390, 3)).toBe(0)
    expect(slideIndexFromScroll(5000, 390, 3)).toBe(2)
    expect(slideIndexFromScroll(390, 390, 1)).toBe(0)
  })

  it('never throws on zero width, zero count or bad numbers', () => {
    expect(slideIndexFromScroll(100, 0, 3)).toBe(0)
    expect(slideIndexFromScroll(100, -1, 3)).toBe(0)
    expect(slideIndexFromScroll(100, 390, 0)).toBe(0)
    expect(slideIndexFromScroll(Number.NaN, 390, 3)).toBe(0)
    expect(slideIndexFromScroll(100, Number.NaN, 3)).toBe(0)
    expect(slideIndexFromScroll(100, 390, Number.NaN)).toBe(0)
  })
})

describe('formatPlace', () => {
  it('joins prefecture and city with a space', () => {
    expect(formatPlace('富山県', '富山市')).toBe('富山県 富山市')
  })

  it('shows only the part that exists', () => {
    expect(formatPlace('富山県', undefined)).toBe('富山県')
    expect(formatPlace(undefined, '高岡市')).toBe('高岡市')
    expect(formatPlace(' 石川県 ', '  ')).toBe('石川県')
  })

  it('is empty when neither exists', () => {
    expect(formatPlace(undefined, undefined)).toBe('')
    expect(formatPlace('', ' ')).toBe('')
  })
})
