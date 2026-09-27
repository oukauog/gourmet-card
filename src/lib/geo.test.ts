import { describe, expect, it } from 'vitest'
import cityJson from '../data/cities.json'
import stationJson from '../data/stations.json'
import {
  autofillPlace,
  buildCityMap,
  buildStationMaster,
  citiesOf,
  findStation,
  isKanaOnly,
  stationChoiceLabel,
  stationLabel,
  stationLocation,
  stationQuery,
  suggestStations,
  type CityTable,
  type Station,
  type StationTable,
} from './geo'
import { PREFECTURES } from './prefectures'

const CITY_TABLE = cityJson as unknown as CityTable
const REAL = buildStationMaster(stationJson as unknown as StationTable, CITY_TABLE)
const CITIES = buildCityMap(CITY_TABLE)
const named = (name: string, prefecture?: string) => REAL.stations.filter((s) => s.name === name && (!prefecture || s.prefecture === prefecture))

describe('generated masters (real data)', () => {
  it('municipalities: 1,741 (1,718 + 23 wards), 富山県 has 15, code order', () => {
    expect([...CITIES.values()].reduce((n, l) => n + l.length, 0)).toBe(1741)
    expect(CITY_TABLE).toHaveLength(47)
    expect(citiesOf(CITIES, '富山県')).toHaveLength(15)
    expect(citiesOf(CITIES, '富山県').slice(0, 3)).toEqual(['富山市', '高岡市', '魚津市'])
    expect(citiesOf(CITIES, '東京都').filter((c) => c.endsWith('区'))).toHaveLength(23)
    expect(citiesOf(CITIES, '東京都')[0]).toBe('千代田区')
    // cities only: no wards of designated cities, no 郡
    expect(citiesOf(CITIES, '大阪府')).toContain('大阪市')
    expect(citiesOf(CITIES, '大阪府').some((c) => c.startsWith('大阪市') && c !== '大阪市')).toBe(false)
    expect(citiesOf(CITIES, '富山県')).toContain('上市町')
    for (const l of CITIES.values()) expect(l.some((c) => c.endsWith('郡'))).toBe(false)
    expect(citiesOf(CITIES, '')).toEqual([])
    expect(citiesOf(CITIES, '未知県')).toEqual([])
  })

  it('stations: prefecture and city from the address', () => {
    expect(named('富山', '富山県').map((s) => s.city)).toEqual(['富山市'])
    expect(named('郡山', '福島県').map((s) => s.city)).toEqual(['郡山市'])
    expect(named('上市', '富山県').map((s) => s.city)).toEqual(['上市町'])
    expect(named('大阪', '大阪府').map((s) => s.city)).toEqual(['大阪市'])
    expect(named('東京', '東京都').map((s) => s.city)).toEqual(['千代田区'])
    // 郡 inside a city name is not dropped
    expect(named('蒲郡', '愛知県').map((s) => s.city)).toEqual(['蒲郡市'])
    expect(named('近鉄郡山', '奈良県').map((s) => s.city)).toEqual(['大和郡山市'])
  })

  it('extra Shinkansen stations are in; one group per station', () => {
    expect(named('黒部宇奈月温泉')).toEqual([{ id: 'x09', name: '黒部宇奈月温泉', prefecture: '富山県', city: '黒部市' }])
    expect(named('奥津軽いまべつ')).toHaveLength(1) // in the free data already: not added twice
    expect(findStation(REAL, 'x02')).toBeUndefined()
    expect(named('金沢', '石川県')).toHaveLength(1) // the group of IR / 北鉄 金沢 is named 金沢
    expect(named('魚津', '富山県')).toHaveLength(1)
    expect(new Set(REAL.stations.map((s) => s.id)).size).toBe(REAL.stations.length)
  })

  it('府中 is in 東京都 and 広島県', () => {
    const prefs = named('府中').map((s) => s.prefecture)
    expect(prefs).toContain('東京都')
    expect(prefs).toContain('広島県')
  })

  it('every city of a station is in that prefecture of the municipality master', () => {
    for (const s of REAL.stations) {
      expect(PREFECTURES).toContain(s.prefecture)
      if (s.city !== undefined) expect(citiesOf(CITIES, s.prefecture)).toContain(s.city)
    }
  })
})

// ---------- pure functions on a small hand-made master ----------

const T = (p: string) => PREFECTURES.indexOf(p)
function tiny(): ReturnType<typeof buildStationMaster> {
  const cities: string[][] = PREFECTURES.map(() => [])
  const stations: [string, string, number][][] = PREFECTURES.map(() => [])
  const add = (id: string, name: string, pref: string, city?: string) => {
    const p = T(pref)
    let c = -1
    if (city) {
      if (!cities[p].includes(city)) cities[p].push(city)
      c = cities[p].indexOf(city)
    }
    stations[p].push([id, name, c])
  }
  add('1', '富山', '富山県', '富山市')
  add('2', '富山口', '富山県', '富山市')
  add('3', '東富山', '富山県', '富山市')
  add('4', '新富山', '富山県', '富山市')
  add('5', '富山北口', '富山県', '富山市')
  add('10', '府中', '東京都', '府中市')
  add('11', '府中', '広島県', '府中市')
  add('12', '府中本町', '東京都', '府中市')
  add('20', '吹田', '大阪府', '吹田市')
  add('21', '吹田', '大阪府', '吹田市')
  add('22', '白石', '北海道', '札幌市')
  add('23', '白石', '北海道', '札幌市')
  add('24', '白石', '宮城県', '白石市')
  add('30', '阿佐ケ谷', '東京都', '杉並区')
  add('31', '幡ヶ谷', '東京都', '渋谷区')
  add('40', '富山駅', '富山県', '富山市')
  add('41', '東京ディズニーランド・ステーション', '千葉県', '浦安市')
  add('42', '駅名なし市', '石川県')
  add('50', '高岡', '富山県', '高岡市')
  add('x09', '黒部宇奈月温泉', '富山県', '黒部市')
  add('60', 'トヨタモビリティ富山 Gスクエア五福前', '富山県', '富山市')
  return buildStationMaster(stations, cities)
}
const M = tiny()
const ids = (l: Station[]) => l.map((s) => s.id)

describe('suggestStations', () => {
  it('prefix first, then partial; shorter names first', () => {
    expect(ids(suggestStations(M, '富山'))).toEqual(['1', '2', '40', '5', '3', '4', '60'])
  })

  it('stations of the chosen prefecture come first in each group', () => {
    expect(ids(suggestStations(M, '府中'))).toEqual(['10', '11', '12']) // 東京都 before 広島県 (prefecture order)
    expect(ids(suggestStations(M, '府中', '広島県'))).toEqual(['11', '10', '12'])
    expect(ids(suggestStations(M, '白石', '宮城県'))).toEqual(['24', '22', '23'])
  })

  it('ヶ and ケ are the same; a trailing 駅, spaces and full-width letters are ignored', () => {
    expect(ids(suggestStations(M, '阿佐ヶ谷'))).toEqual(['30'])
    expect(ids(suggestStations(M, '幡ケ谷'))).toEqual(['31'])
    expect(ids(suggestStations(M, '高岡駅'))).toEqual(['50'])
    expect(ids(suggestStations(M, ' 高 岡 '))).toEqual(['50'])
    expect(ids(suggestStations(M, 'Ｇスクエア'))).toEqual(['60'])
    expect(ids(suggestStations(M, 'gスクエア'))).toEqual([]) // case is not folded (the data has upper case)
    expect(stationQuery('富山駅')).toBe('富山')
    expect(stationQuery('ﾄﾔﾏ')).toBe('トヤマ')
  })

  it('one character is enough; empty input gives nothing; at most 8', () => {
    expect(suggestStations(M, '府').length).toBe(3)
    expect(suggestStations(M, '')).toEqual([])
    expect(suggestStations(M, '  ')).toEqual([])
    expect(suggestStations(M, '駅')).toEqual([]) // only the trailing 駅 -> empty query
    const many = suggestStations(REAL, '新')
    expect(many).toHaveLength(8)
    expect(suggestStations(M, '富', undefined, 3)).toHaveLength(3)
  })

  it('real data: 富山 -> 富山駅 (富山県富山市) first', () => {
    const [first] = suggestStations(REAL, '富山')
    expect([first.name, stationLocation(first)]).toEqual(['富山', '富山県富山市'])
    expect(suggestStations(REAL, 'とやま')).toEqual([])
    expect(suggestStations(REAL, '黒部宇奈月温泉').map((s) => s.id)).toEqual(['x09'])
  })
})

describe('station names', () => {
  it('short label: name + 駅 (not for names ending with 駅 / ステーション)', () => {
    expect(stationLabel({ name: '富山' })).toBe('富山駅')
    expect(stationLabel({ name: '富山駅' })).toBe('富山駅')
    expect(stationLabel({ name: '東京ディズニーランド・ステーション' })).toBe('東京ディズニーランド・ステーション')
    expect(stationLabel({ name: '駅前' })).toBe('駅前駅')
  })

  it('choice label: prefecture only when another prefecture has the name, city when the same one does', () => {
    const at = (id: string) => stationChoiceLabel(M, findStation(M, id)!)
    expect(at('1')).toBe('富山駅')
    expect(at('10')).toBe('府中駅（東京都）')
    expect(at('11')).toBe('府中駅（広島県）')
    expect(at('20')).toBe('吹田駅（吹田市）')
    expect(at('22')).toBe('白石駅（札幌市）')
    expect(at('24')).toBe('白石駅（宮城県）')
    expect(stationLocation(findStation(M, '42')!)).toBe('石川県')
  })

  it('unknown ids are "not found", never an exception', () => {
    expect(findStation(M, 'nope')).toBeUndefined()
    expect(findStation(M, undefined)).toBeUndefined()
    expect(findStation(M, '')).toBeUndefined()
  })

  it('kana only', () => {
    expect(isKanaOnly('とやま')).toBe(true)
    expect(isKanaOnly('トヤマ')).toBe(true)
    expect(isKanaOnly('ﾄﾔﾏ')).toBe(true)
    expect(isKanaOnly('とやま ')).toBe(true)
    expect(isKanaOnly('富山')).toBe(false)
    expect(isKanaOnly('とやま駅')).toBe(false)
    expect(isKanaOnly('')).toBe(false)
  })
})

describe('autofillPlace', () => {
  const toyama = findStation(M, '1')!
  const noCity = findStation(M, '42')!
  it('both empty: prefecture and city of the station', () => {
    expect(autofillPlace({ prefecture: '', city: '' }, toyama)).toEqual({ prefecture: '富山県', city: '富山市' })
  })
  it('same prefecture, empty city: the city', () => {
    expect(autofillPlace({ prefecture: '富山県', city: '' }, toyama)).toEqual({ prefecture: '富山県', city: '富山市' })
  })
  it('never overwrites: another prefecture keeps its (empty) city', () => {
    expect(autofillPlace({ prefecture: '石川県', city: '' }, toyama)).toEqual({ prefecture: '石川県', city: '' })
    expect(autofillPlace({ prefecture: '石川県', city: '金沢市' }, toyama)).toEqual({ prefecture: '石川県', city: '金沢市' })
  })
  it('never overwrites: a city already set stays', () => {
    expect(autofillPlace({ prefecture: '富山県', city: '高岡市' }, toyama)).toEqual({ prefecture: '富山県', city: '高岡市' })
    expect(autofillPlace({ prefecture: '', city: '高岡市' }, toyama)).toEqual({ prefecture: '富山県', city: '高岡市' })
  })
  it('a station without a city fills only the prefecture', () => {
    expect(autofillPlace({ prefecture: '', city: '' }, noCity)).toEqual({ prefecture: '石川県', city: '' })
  })
})
