// Construction 7: city / station in the "場所" filter.
import { describe, expect, it } from 'vitest'
import {
  cityKey,
  clearFilterLists,
  emptyFilter,
  filterChipLabels,
  filterOptions,
  filterShops,
  isFilterActive,
  PLACE_LIST_KEYS,
  toggleFilterValue,
  type FilterableShop,
  type StationLookup,
} from './shopFilter'

type S = FilterableShop & { id: string }
const shop = (id: string, p: Partial<FilterableShop> = {}): S => ({ id, areaTagIds: [], genreTagIds: [], useTagIds: [], ...p })

const SHOPS: S[] = [
  shop('a', { prefecture: '東京都', city: '府中市', stationId: 'fuchu-tokyo', genreTagIds: ['g1'] }),
  shop('b', { prefecture: '広島県', city: '府中市', stationId: 'fuchu-hiroshima' }),
  shop('c', { prefecture: '富山県', city: '富山市', stationId: 'toyama', genreTagIds: ['g1'] }),
  shop('d', { prefecture: '富山県', city: '富山市' }),
  shop('e', { prefecture: '富山県', city: '高岡市', stationId: 'takaoka', areaTagIds: ['a1'] }),
  shop('f', { city: '富山市' }), // a city without a prefecture (e.g. old data)
  shop('g'),
]
const STATIONS: Record<string, { name: string; short: string; prefecture: string }> = {
  'fuchu-tokyo': { name: '府中駅（東京都）', short: '府中駅', prefecture: '東京都' },
  'fuchu-hiroshima': { name: '府中駅（広島県）', short: '府中駅', prefecture: '広島県' },
  toyama: { name: '富山駅', short: '富山駅', prefecture: '富山県' },
  takaoka: { name: '高岡駅', short: '高岡駅', prefecture: '富山県' },
}
const LOOKUP: StationLookup = { name: (id) => STATIONS[id]?.name, prefecture: (id) => STATIONS[id]?.prefecture }
const shortName = (id: string) => STATIONS[id]?.short
const tagName = (id: string) => ({ g1: 'ラーメン', a1: '末広町' })[id]
const ids = (l: S[]) => l.map((s) => s.id)

describe('city / station filter', () => {
  it('the empty filter has no cities / stations; both make it active', () => {
    expect(emptyFilter()).toMatchObject({ cities: [], stationIds: [] })
    expect(isFilterActive(toggleFilterValue(emptyFilter(), 'cities', cityKey('富山県', '富山市')))).toBe(true)
    expect(isFilterActive(toggleFilterValue(emptyFilter(), 'stationIds', 'toyama'))).toBe(true)
  })

  it('a city is matched together with its prefecture (東京都府中市 is not 広島県府中市)', () => {
    const f = toggleFilterValue(emptyFilter(), 'cities', cityKey('東京都', '府中市'))
    expect(ids(filterShops(SHOPS, f))).toEqual(['a'])
    // ANY of the chosen cities
    const two = toggleFilterValue(f, 'cities', cityKey('富山県', '富山市'))
    expect(ids(filterShops(SHOPS, two))).toEqual(['a', 'c', 'd'])
    // a city without a prefecture has its own key
    expect(ids(filterShops(SHOPS, toggleFilterValue(emptyFilter(), 'cities', cityKey(undefined, '富山市'))))).toEqual(['f'])
  })

  it('stations: ANY of the chosen ones', () => {
    const f = toggleFilterValue(toggleFilterValue(emptyFilter(), 'stationIds', 'toyama'), 'stationIds', 'takaoka')
    expect(ids(filterShops(SHOPS, f))).toEqual(['c', 'e'])
    expect(ids(filterShops(SHOPS, toggleFilterValue(emptyFilter(), 'stationIds', 'unknown')))).toEqual([])
  })

  it('different kinds: AND (prefecture x city x station x genre x area)', () => {
    let f = toggleFilterValue(emptyFilter(), 'prefectures', '富山県')
    f = toggleFilterValue(f, 'cities', cityKey('富山県', '富山市'))
    expect(ids(filterShops(SHOPS, f))).toEqual(['c', 'd'])
    expect(ids(filterShops(SHOPS, toggleFilterValue(f, 'stationIds', 'toyama')))).toEqual(['c'])
    expect(ids(filterShops(SHOPS, toggleFilterValue(f, 'genreTagIds', 'g1')))).toEqual(['c'])
    expect(ids(filterShops(SHOPS, toggleFilterValue(f, 'areaTagIds', 'a1')))).toEqual([])
    // a station in another prefecture than the chosen one -> nothing
    expect(ids(filterShops(SHOPS, toggleFilterValue(toggleFilterValue(emptyFilter(), 'prefectures', '富山県'), 'stationIds', 'fuchu-tokyo')))).toEqual([])
  })

  it('the 場所 panel clears prefectures, cities, stations and areas only', () => {
    let f = toggleFilterValue(emptyFilter(), 'prefectures', '富山県')
    f = toggleFilterValue(f, 'cities', cityKey('富山県', '富山市'))
    f = toggleFilterValue(f, 'stationIds', 'toyama')
    f = toggleFilterValue(f, 'areaTagIds', 'a1')
    f = toggleFilterValue(f, 'genreTagIds', 'g1')
    expect(clearFilterLists(f, PLACE_LIST_KEYS)).toEqual({ ...emptyFilter(), genreTagIds: ['g1'] })
  })
})

describe('city / station candidates', () => {
  const opts = (f = emptyFilter(), lookup: StationLookup | undefined = LOOKUP) => filterOptions(SHOPS, f, tagName, lookup)

  it('cities with counts, most used first; a name used in two prefectures gets the prefecture', () => {
    // (ties by Intl.Collator('ja'): 高岡市 before 富山市 before 府中市)
    expect(opts().cities.map((o) => [o.name, o.count])).toEqual([
      ['富山市（富山県）', 2],
      ['高岡市', 1],
      ['富山市', 1],
      ['府中市（広島県）', 1],
      ['府中市（東京都）', 1],
    ])
    // the other 富山市 is the one without a prefecture (it has no prefecture to add)
    expect(opts().cities.find((o) => o.name === '富山市')!.value).toBe(cityKey(undefined, '富山市'))
  })

  it('stations: names from the master, counts; none without the master', () => {
    expect(opts().stations.map((o) => [o.name, o.count])).toEqual([
      ['高岡駅', 1],
      ['富山駅', 1],
      ['府中駅（広島県）', 1],
      ['府中駅（東京都）', 1],
    ])
    expect(filterOptions(SHOPS, emptyFilter(), tagName).stations).toEqual([])
  })

  it('with prefectures chosen, only their cities / stations are offered (chosen ones stay)', () => {
    let f = toggleFilterValue(emptyFilter(), 'prefectures', '富山県')
    expect(opts(f).cities.map((o) => o.name)).toEqual(['富山市', '高岡市'])
    expect(opts(f).stations.map((o) => o.name)).toEqual(['高岡駅', '富山駅'])
    // prefectures are not narrowed; genres are not either
    expect(opts(f).prefectures.map((o) => o.name)).toEqual(['富山県', '広島県', '東京都'])
    // a chosen city / station of another prefecture stays so that it can be taken off
    f = toggleFilterValue(toggleFilterValue(f, 'cities', cityKey('東京都', '府中市')), 'stationIds', 'fuchu-tokyo')
    expect(opts(f).cities.map((o) => [o.name, o.selected])).toEqual([
      ['富山市', false],
      ['高岡市', false],
      ['府中市', true],
    ])
    expect(opts(f).stations.map((o) => [o.name, o.selected])).toEqual([
      ['高岡駅', false],
      ['富山駅', false],
      ['府中駅（東京都）', true],
    ])
  })

  it('a chosen station unknown to the master is shown as （見つからない駅）; unknown ids on shops are skipped', () => {
    const shops = [...SHOPS, shop('h', { stationId: 'gone' })]
    expect(filterOptions(shops, emptyFilter(), tagName, LOOKUP).stations.some((o) => o.value === 'gone')).toBe(false)
    const f = toggleFilterValue(emptyFilter(), 'stationIds', 'gone')
    expect(filterOptions(shops, f, tagName, LOOKUP).stations.find((o) => o.value === 'gone')).toMatchObject({ name: '（見つからない駅）', count: 1 })
  })
})

describe('場所 chip: prefectures -> cities -> stations -> areas', () => {
  it('counts them together in that order', () => {
    let f = toggleFilterValue(emptyFilter(), 'areaTagIds', 'a1')
    expect(filterChipLabels(f, tagName, shortName).place).toBe('末広町')
    f = toggleFilterValue(f, 'stationIds', 'toyama')
    expect(filterChipLabels(f, tagName, shortName).place).toBe('富山駅 ほか1')
    f = toggleFilterValue(f, 'cities', cityKey('富山県', '富山市'))
    expect(filterChipLabels(f, tagName, shortName).place).toBe('富山市 ほか2')
    f = toggleFilterValue(f, 'prefectures', '富山県')
    expect(filterChipLabels(f, tagName, shortName).place).toBe('富山県 ほか3')
  })

  it('without a station name (master not loaded / unknown id) the chip still has text', () => {
    const f = toggleFilterValue(emptyFilter(), 'stationIds', 'toyama')
    expect(filterChipLabels(f, tagName).place).toBe('（見つからない駅）')
    expect(filterChipLabels(emptyFilter(), tagName).place).toBe('場所')
  })
})
