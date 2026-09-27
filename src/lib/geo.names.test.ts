// Construction 7a: other names inside a station group became stations of their own.
import { describe, expect, it } from 'vitest'
import cityJson from '../data/cities.json'
import stationJson from '../data/stations.json'
import added07a from './fixtures/stations-added-07a.json'
import before from './fixtures/stations-before-07a.json'
import { buildStationMaster, stationChoiceLabel, suggestStations, type CityTable, type StationTable } from './geo'

const M = buildStationMaster(stationJson as unknown as StationTable, cityJson as unknown as CityTable)
const BEFORE = before as unknown as [string, string, string, string | null][]
const named = (name: string) => M.stations.filter((s) => s.name === name)

describe('regression: every station of construction 7 is unchanged', () => {
  it(`all ${BEFORE.length} stations keep id, name, prefecture and city`, () => {
    expect(BEFORE).toHaveLength(8783)
    const changed = BEFORE.filter(([id, name, prefecture, city]) => {
      const s = M.byId.get(id)
      return !s || s.name !== name || s.prefecture !== prefecture || (s.city ?? null) !== city
    })
    expect(changed).toEqual([])
  })

  it('only additions: 198 stations of other names (construction 7c: 200 - 2), ids never reused', () => {
    const old = new Set(BEFORE.map(([id]) => id))
    const added = M.stations.filter((s) => !old.has(s.id))
    expect(added).toHaveLength(198)
    expect(added.every((s) => /^\d+$/.test(s.id))).toBe(true)
    expect(M.stations).toHaveLength(8981)
    expect(new Set(M.stations.map((s) => s.id)).size).toBe(M.stations.length)
  })
})

describe('construction 7b / 7c: other names with the same name in the same prefecture and city are not added', () => {
  const ADDED_07A = added07a as unknown as [string, string, string, string | null][]
  const REMOVED = ['9921410', '3500103'] // 仙台 (あおば通), 野田 (海老江)
  const RESTORED = '9962113' // 高井田 (高井田中央; 東大阪市): removed in 7b, back in 7c

  it('the other 198 stations added in 7a keep id, name, prefecture and city (高井田 included); exactly 2 are gone', () => {
    expect(ADDED_07A).toHaveLength(200)
    const kept = ADDED_07A.filter(([id]) => !REMOVED.includes(id))
    expect(kept).toHaveLength(198)
    expect(kept.some(([id]) => id === RESTORED)).toBe(true)
    const changed = kept.filter(([id, name, prefecture, city]) => {
      const s = M.byId.get(id)
      return !s || s.name !== name || s.prefecture !== prefecture || (s.city ?? null) !== city
    })
    expect(changed).toEqual([])
    expect(REMOVED.map((id) => M.byId.get(id))).toEqual([undefined, undefined])
    expect(ADDED_07A.filter(([id]) => REMOVED.includes(id)).map(([, n]) => n).sort()).toEqual(['仙台', '野田'].sort())
    // 高井田 is back with the very values of construction 7a
    const [, name, prefecture, city] = ADDED_07A.find(([id]) => id === RESTORED)!
    expect(M.byId.get(RESTORED)).toEqual({ id: RESTORED, name, prefecture, city })
    expect([name, prefecture, city]).toEqual(['高井田', '大阪府', '東大阪市'])
  })

  it('仙台 / 野田: one station in the city (the representatives stay); 高井田: 東大阪市 and 柏原市', () => {
    const sendai = suggestStations(M, '仙台').filter((s) => s.name === '仙台' && s.prefecture === '宮城県')
    expect(sendai.map((s) => [s.id, s.city])).toEqual([['1123143', '仙台市']])
    expect(named('野田').filter((s) => s.prefecture === '大阪府').map((s) => [s.id, s.city])).toEqual([['1162308', '大阪市']])
    // 高井田: the JR one (柏原市) and the Osaka Metro one (東大阪市) are different places (7c)
    expect(named('高井田').filter((s) => s.prefecture === '大阪府').map((s) => [s.id, s.city])).toEqual([
      ['1160711', '柏原市'],
      ['9962113', '東大阪市'],
    ])
    const takaida = suggestStations(M, '高井田').filter((s) => s.name === '高井田')
    expect(takaida.map((s) => stationChoiceLabel(M, s)).sort()).toEqual(['高井田駅（東大阪市）', '高井田駅（柏原市）'].sort())
    expect(named('高井田中央').map((s) => s.city)).toEqual(['東大阪市'])
  })
})

describe('other names are found', () => {
  it('淡路町: 東京都千代田区, one station', () => {
    expect(named('淡路町').map((s) => [s.prefecture, s.city])).toEqual([['東京都', '千代田区']])
  })

  it('小川町: 東京都 and 埼玉県, told apart by the prefecture', () => {
    const l = named('小川町')
    expect(l.map((s) => [s.prefecture, s.city]).sort()).toEqual([
      ['埼玉県', '小川町'],
      ['東京都', '千代田区'],
    ])
    expect(l.map((s) => stationChoiceLabel(M, s)).sort()).toEqual(['小川町駅（埼玉県）', '小川町駅（東京都）'])
    expect(suggestStations(M, '小川町').filter((s) => s.name === '小川町')).toHaveLength(2)
  })

  it('names that used to be hidden now appear as candidates', () => {
    for (const q of ['新御茶ノ水', '日比谷', '永田町', '三越前', '虎ノ門ヒルズ', '南富山駅前', '電鉄富山', '宇奈月']) {
      expect(suggestStations(M, q).map((s) => s.name), q).toContain(q)
    }
    expect(named('梅田').map((s) => [s.prefecture, s.city])).toEqual([['大阪府', '大阪市']])
    expect(suggestStations(M, '梅田')[0].name).toBe('梅田')
    // 市ヶ谷 is the same name as the representative 市ケ谷 (ヶ = ケ): found, not doubled
    expect(suggestStations(M, '市ヶ谷').filter((s) => s.name.startsWith('市'))).toHaveLength(1)
    expect(suggestStations(M, '市ヶ谷')[0].name).toBe('市ケ谷')
  })

  it('representatives keep their ids (御茶ノ水)', () => {
    const was = BEFORE.find(([, name, pref]) => name === '御茶ノ水' && pref === '東京都')!
    expect(named('御茶ノ水').map((s) => s.id)).toEqual([was[0]])
  })

  it('no doubles from spelling only: 押上 once, 富山駅 once, 高岡 once', () => {
    expect(suggestStations(M, '押上').filter((s) => s.name.startsWith('押上'))).toHaveLength(1)
    const toyama = suggestStations(M, '富山').filter((s) => s.prefecture === '富山県' && s.city === '富山市' && /^富山駅?$/.test(s.name))
    expect(toyama).toHaveLength(1)
    expect(M.stations.filter((s) => s.prefecture === '富山県' && /^高岡駅?$/.test(s.name))).toHaveLength(1)
  })
})
