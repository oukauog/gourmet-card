import { describe, expect, it } from 'vitest'
import { formatHash, parseHash, type Route } from './hashRoute'

describe('parseHash', () => {
  it.each(['', '#', '#/'])('%j -> home', (h) => {
    expect(parseHash(h)).toEqual({ screen: 'home' })
  })

  it('#/register -> register', () => {
    expect(parseHash('#/register')).toEqual({ screen: 'register' })
  })

  it('#/shop/<id> -> shop', () => {
    expect(parseHash('#/shop/abc')).toEqual({ screen: 'shop', id: 'abc' })
  })

  it('decodes an encoded id', () => {
    expect(parseHash('#/shop/a%2Fb%20c')).toEqual({ screen: 'shop', id: 'a/b c' })
    expect(parseHash('#/shop/%E5%AF%BF%E5%8F%B8')).toEqual({ screen: 'shop', id: '寿司' })
  })

  it.each(['#/foo', '#/shop/', '#/shop', '#/shop/a/b', '#/register/x', '#register', '#/shop/%E0%A4%A', 'garbage'])(
    'unknown or broken %j -> home',
    (h) => {
      expect(parseHash(h)).toEqual({ screen: 'home' })
    },
  )
})

describe('formatHash', () => {
  it('formats each route', () => {
    expect(formatHash({ screen: 'home' })).toBe('#/')
    expect(formatHash({ screen: 'register' })).toBe('#/register')
    expect(formatHash({ screen: 'shop', id: 'abc' })).toBe('#/shop/abc')
  })

  it.each<Route>([
    { screen: 'home' },
    { screen: 'register' },
    { screen: 'shop', id: '3f2a1c9e-7b4d-4e21-9a0b-5c6d7e8f9a0b' },
    { screen: 'shop', id: 'a/b?c#d%e f&g=h' },
    { screen: 'shop', id: '店/名前 #1' },
  ])('round-trips %j', (r) => {
    expect(parseHash(formatHash(r))).toEqual(r)
  })
})
