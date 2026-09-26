import { describe, expect, it } from 'vitest'
import type { Shop, Tag } from '../db/types'
import { emptyShopForm, sameShopForm, shopFormFromShop, shopFormToData } from './shopForm'

const tag = (id: string, kind: Tag['kind'], name: string): Tag => ({ id, kind, name, normalizedKey: name.toLowerCase(), createdAt: '' })
const TAGS = new Map([tag('g1', 'genre', 'ラーメン'), tag('u1', 'use', '個室あり'), tag('a1', 'area', '総曲輪')].map((t) => [t.id, t]))

const SHOP: Shop = {
  id: 's1',
  name: '麺屋',
  status: 'wishlist',
  photoIds: [],
  rating: 37,
  prefecture: '富山県',
  city: '富山市',
  areaTagIds: ['a1'],
  genreTagIds: ['g1', 'gone'],
  useTagIds: ['u1'],
  mapUrl: 'https://example.com',
  memo: 'a\nb',
  origin: 'self',
  createdAt: '',
  updatedAt: '',
}

describe('shop form values', () => {
  it('empty form: 手札, not rated, nothing else', () => {
    expect(emptyShopForm()).toEqual({
      name: '',
      status: 'visited',
      rating: undefined,
      genres: [],
      uses: [],
      areas: [],
      prefecture: '',
      mapUrl: '',
      memo: '',
    })
  })

  it('reads a saved shop (unknown tag ids are skipped)', () => {
    const v = shopFormFromShop(SHOP, TAGS)
    expect(v.name).toBe('麺屋')
    expect(v.status).toBe('wishlist')
    expect(v.rating).toBe(37)
    expect(v.genres).toEqual([{ key: 'ラーメン', name: 'ラーメン', id: 'g1' }])
    expect(v.uses.map((d) => d.id)).toEqual(['u1'])
    expect(v.areas.map((d) => d.id)).toEqual(['a1'])
    expect([v.prefecture, v.mapUrl, v.memo]).toEqual(['富山県', 'https://example.com', 'a\nb'])
  })

  it('missing optional strings become empty strings', () => {
    const { prefecture: _p, mapUrl: _m, memo: _n, ...rest } = SHOP
    const v = shopFormFromShop(rest as Shop, TAGS)
    expect([v.prefecture, v.mapUrl, v.memo]).toEqual(['', '', ''])
  })

  it('sameShopForm sees every change', () => {
    const base = shopFormFromShop(SHOP, TAGS)
    expect(sameShopForm(base, shopFormFromShop(SHOP, TAGS))).toBe(true)
    const changes: Partial<typeof base>[] = [
      { name: '麺屋 ' },
      { status: 'visited' },
      { rating: undefined },
      { rating: 38 },
      { genres: [] },
      { uses: [...base.uses, { key: 'x', name: 'x' }] },
      { areas: [{ key: '八尾', name: '八尾' }] },
      { prefecture: '' },
      { mapUrl: '' },
      { memo: 'a\nb\n' },
    ]
    for (const c of changes) expect(sameShopForm(base, { ...base, ...c })).toBe(false)
  })

  it('to save data: URL trimmed, blanks are not set, memo line breaks kept, tags by id or name', () => {
    const d = shopFormToData({
      ...emptyShopForm(),
      name: '店',
      mapUrl: '  https://maps.app.goo.gl/x \n',
      memo: '1行目\n2行目',
      prefecture: '',
      genres: [
        { key: 'ラーメン', name: 'ラーメン', id: 'g1' },
        { key: '新', name: '新' },
      ],
    })
    expect(d.mapUrl).toBe('https://maps.app.goo.gl/x')
    expect(d.memo).toBe('1行目\n2行目')
    expect(d.prefecture).toBeUndefined()
    expect(d.genres).toEqual([{ id: 'g1', name: 'ラーメン' }, { name: '新' }])
    const blank = shopFormToData({ ...emptyShopForm(), name: '店', mapUrl: '   ', memo: ' \n ' })
    expect([blank.mapUrl, blank.memo, blank.rating]).toEqual([undefined, undefined, undefined])
  })
})
