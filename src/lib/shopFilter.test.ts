import { describe, expect, it } from 'vitest'
import {
  clearFilterLists,
  emptyFilter,
  filterChipLabels,
  filterOptions,
  filterShops,
  isFilterActive,
  matchesFilter,
  MIN_RATING_CHOICES,
  MISSING_TAG_NAME,
  namesLabel,
  ratingChipLabel,
  resultCountText,
  setMinRating,
  setUnratedOnly,
  toggleFilterValue,
  type FilterableShop,
  type ShopFilter,
} from './shopFilter'

type S = FilterableShop & { id: string }
const shop = (id: string, p: Partial<FilterableShop> = {}): S => ({ id, areaTagIds: [], genreTagIds: [], useTagIds: [], ...p })

// genre: g1 ラーメン, g2 寿司, g3 カフェ / use: u1 個室あり, u2 駐車場あり / area: a1 総曲輪, a2 八尾
const NAMES: Record<string, string> = { g1: 'ラーメン', g2: '寿司', g3: 'カフェ', u1: '個室あり', u2: '駐車場あり', a1: '総曲輪', a2: '八尾' }
const tagName = (id: string) => NAMES[id]

const SHOPS: S[] = [
  shop('A', { prefecture: '富山県', genreTagIds: ['g1'], useTagIds: ['u1', 'u2'], areaTagIds: ['a1'], rating: 40 }),
  shop('B', { prefecture: '富山県', genreTagIds: ['g2'], useTagIds: ['u1'], rating: 39 }),
  shop('C', { prefecture: '石川県', genreTagIds: ['g1', 'g3'], useTagIds: ['u2'], areaTagIds: ['a2'] }),
  shop('D', { genreTagIds: ['g3'], rating: 45 }),
  shop('E', {}),
]
const ids = (f: ShopFilter) => filterShops(SHOPS, f).map((s) => s.id)
const f = (p: Partial<ShopFilter>): ShopFilter => ({ ...emptyFilter(), ...p })

describe('empty / active', () => {
  it('empty filter shows every shop in order', () => {
    expect(ids(emptyFilter())).toEqual(['A', 'B', 'C', 'D', 'E'])
    expect(isFilterActive(emptyFilter())).toBe(false)
  })

  it('any condition makes it active', () => {
    for (const p of [{ prefectures: ['x'] }, { areaTagIds: ['x'] }, { genreTagIds: ['x'] }, { useTagIds: ['x'] }, { minRating: 30 }, { unratedOnly: true }])
      expect(isFilterActive(f(p))).toBe(true)
  })
})

describe('matching rules', () => {
  it('prefecture: any of them; shops without a prefecture do not match', () => {
    expect(ids(f({ prefectures: ['富山県'] }))).toEqual(['A', 'B'])
    expect(ids(f({ prefectures: ['富山県', '石川県'] }))).toEqual(['A', 'B', 'C'])
  })

  it('genre and area: any of them', () => {
    expect(ids(f({ genreTagIds: ['g1'] }))).toEqual(['A', 'C'])
    expect(ids(f({ genreTagIds: ['g1', 'g2'] }))).toEqual(['A', 'B', 'C'])
    expect(ids(f({ areaTagIds: ['a1', 'a2'] }))).toEqual(['A', 'C'])
  })

  it('use: all of them', () => {
    expect(ids(f({ useTagIds: ['u1'] }))).toEqual(['A', 'B'])
    expect(ids(f({ useTagIds: ['u1', 'u2'] }))).toEqual(['A'])
  })

  it('different kinds: and', () => {
    expect(ids(f({ genreTagIds: ['g1', 'g3'], prefectures: ['富山県'] }))).toEqual(['A'])
    expect(ids(f({ genreTagIds: ['g1', 'g2'], useTagIds: ['u1'], minRating: 40 }))).toEqual(['A'])
    expect(ids(f({ prefectures: ['石川県'], useTagIds: ['u1'] }))).toEqual([])
  })

  it('rating: >= minRating; unrated never matches', () => {
    expect(ids(f({ minRating: 40 }))).toEqual(['A', 'D']) // 3.9 and unrated are out, 4.0 stays
    expect(ids(f({ minRating: 30 }))).toEqual(['A', 'B', 'D'])
    expect(ids(f({ minRating: 45 }))).toEqual(['D'])
  })

  it('unrated only', () => {
    expect(ids(f({ unratedOnly: true }))).toEqual(['C', 'E'])
    expect(ids(f({ unratedOnly: true, genreTagIds: ['g1'] }))).toEqual(['C'])
  })

  it('unknown tag ids and unused prefectures just match nothing (no exception)', () => {
    expect(ids(f({ genreTagIds: ['gone'] }))).toEqual([])
    expect(ids(f({ genreTagIds: ['gone', 'g2'] }))).toEqual(['B'])
    expect(ids(f({ useTagIds: ['gone'] }))).toEqual([])
    expect(ids(f({ prefectures: ['沖縄県'] }))).toEqual([])
    expect(matchesFilter(shop('x'), f({ areaTagIds: ['gone'] }))).toBe(false)
  })
})

describe('changing the filter', () => {
  it('toggles values in choosing order and does not change the given filter', () => {
    const a = emptyFilter()
    const b = toggleFilterValue(a, 'genreTagIds', 'g2')
    const c = toggleFilterValue(b, 'genreTagIds', 'g1')
    expect(c.genreTagIds).toEqual(['g2', 'g1'])
    expect(toggleFilterValue(c, 'genreTagIds', 'g2').genreTagIds).toEqual(['g1'])
    expect(a.genreTagIds).toEqual([])
  })

  it('rating and unrated only never work together', () => {
    const on = setUnratedOnly(f({ minRating: 40 }), true)
    expect(on.unratedOnly).toBe(true)
    expect('minRating' in on).toBe(false)
    const rated = setMinRating(on, 35)
    expect(rated).toMatchObject({ minRating: 35, unratedOnly: false })
    // clearing the rating leaves unrated-only as it is
    expect(setMinRating(f({ unratedOnly: true }), undefined).unratedOnly).toBe(true)
    expect('minRating' in setMinRating(f({ minRating: 30 }), undefined)).toBe(false)
    // turning unrated-only off keeps the rating
    expect(setUnratedOnly(f({ minRating: 30 }), false).minRating).toBe(30)
  })

  it('clears only the given lists', () => {
    const x = f({ prefectures: ['富山県'], areaTagIds: ['a1'], genreTagIds: ['g1'], minRating: 40 })
    expect(clearFilterLists(x, ['prefectures', 'areaTagIds'])).toEqual(f({ genreTagIds: ['g1'], minRating: 40 }))
  })

  it('rating choices are 3.0 / 3.5 / 4.0 / 4.5', () => {
    expect(MIN_RATING_CHOICES).toEqual([30, 35, 40, 45])
  })
})

describe('filterOptions', () => {
  it('only values used by the shops, with counts, most first then name order', () => {
    const o = filterOptions(SHOPS, emptyFilter(), tagName)
    expect(o.prefectures.map((x) => [x.name, x.count])).toEqual([
      ['富山県', 2],
      ['石川県', 1],
    ])
    // g1 and g3 are both 2: name order (カフェ before ラーメン), then 寿司 1
    expect(o.genres.map((x) => [x.name, x.count])).toEqual([
      ['カフェ', 2],
      ['ラーメン', 2],
      ['寿司', 1],
    ])
    expect(o.uses.map((x) => [x.value, x.count])).toEqual([
      ['u1', 2],
      ['u2', 2],
    ])
    expect(o.areas.map((x) => x.name)).toEqual(['総曲輪', '八尾'].sort(new Intl.Collator('ja').compare))
    expect(o.genres.every((x) => !x.selected)).toBe(true)
  })

  it('ignores the filter itself (counts are of the given shops)', () => {
    const o = filterOptions(SHOPS, f({ genreTagIds: ['g2'], minRating: 45 }), tagName)
    expect(o.genres.find((x) => x.value === 'g2')).toMatchObject({ count: 1, selected: true })
    expect(o.genres.find((x) => x.value === 'g1')).toMatchObject({ count: 2, selected: false })
  })

  it('keeps chosen values with 0 shops (to take them off); unknown chosen ids get a placeholder name', () => {
    const wishlist = [SHOPS[4]]
    const o = filterOptions(wishlist, f({ genreTagIds: ['g1', 'gone'], prefectures: ['富山県'] }), tagName)
    expect(o.genres).toEqual([
      { value: 'g1', name: 'ラーメン', count: 0, selected: true },
      { value: 'gone', name: MISSING_TAG_NAME, count: 0, selected: true },
    ].sort((a, b) => new Intl.Collator('ja').compare(a.name, b.name)))
    expect(o.prefectures).toEqual([{ value: '富山県', name: '富山県', count: 0, selected: true }])
    expect(o.uses).toEqual([])
  })

  it('skips unknown tag ids found on shops', () => {
    const o = filterOptions([shop('x', { genreTagIds: ['gone', 'g1'] })], emptyFilter(), tagName)
    expect(o.genres.map((x) => x.value)).toEqual(['g1'])
  })

  it('counts a shop once even if an id is duplicated', () => {
    const o = filterOptions([shop('x', { genreTagIds: ['g1', 'g1'] })], emptyFilter(), tagName)
    expect(o.genres[0].count).toBe(1)
  })
})

describe('chip text', () => {
  it('kind name / one name / "first ほかN"', () => {
    expect(namesLabel('ジャンル', [])).toBe('ジャンル')
    expect(namesLabel('ジャンル', ['ラーメン'])).toBe('ラーメン')
    expect(namesLabel('ジャンル', ['ラーメン', '寿司'])).toBe('ラーメン ほか1')
    expect(namesLabel('ジャンル', ['ラーメン', '寿司', 'カフェ'])).toBe('ラーメン ほか2')
  })

  it('labels of each chip; place counts prefectures and areas together', () => {
    expect(filterChipLabels(emptyFilter(), tagName)).toEqual({ place: '場所', genre: 'ジャンル', use: '使い道', rating: '評価' })
    const l = filterChipLabels(f({ prefectures: ['富山県'], areaTagIds: ['a1'], genreTagIds: ['g1'], useTagIds: ['u1', 'u2'], minRating: 40 }), tagName)
    expect(l).toEqual({ place: '富山県 ほか1', genre: 'ラーメン', use: '個室あり ほか1', rating: '4.0以上' })
    expect(filterChipLabels(f({ areaTagIds: ['a2'] }), tagName).place).toBe('八尾')
    expect(filterChipLabels(f({ genreTagIds: ['gone'] }), tagName).genre).toBe(MISSING_TAG_NAME)
  })

  it('rating chip', () => {
    expect(ratingChipLabel(undefined)).toBe('評価')
    expect(ratingChipLabel(30)).toBe('3.0以上')
    expect(ratingChipLabel(45)).toBe('4.5以上')
  })

  it('result count text', () => {
    expect(resultCountText(12, 12, false)).toBe('12件')
    expect(resultCountText(3, 12, true)).toBe('3件（12件中）')
    expect(resultCountText(0, 12, true)).toBe('0件（12件中）')
  })
})
