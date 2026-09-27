// Station and municipality masters (spec 3.5 / 4.2.2, construction 7). Pure: the tables come from
// src/data/*.json (made by `npm run geo-data`) and are passed in, so nothing here loads them.
import { PREFECTURES } from './prefectures'

/** src/data/cities.json: municipality names per prefecture (PREFECTURES order, code order). */
export type CityTable = readonly (readonly string[])[]
/** src/data/stations.json: per prefecture, [id, name, index into that prefecture's cities or -1]. */
export type StationTable = readonly (readonly (readonly [string, string, number])[])[]

export interface Station {
  /** 駅グループコード (station_g_cd) as a string; extra (Shinkansen only) stations are x01... */
  id: string
  name: string
  prefecture: string
  /** Municipality ("富山市", "千代田区"); missing when the address did not give one. */
  city?: string
}

export type CityMap = ReadonlyMap<string, readonly string[]>

export interface StationMaster {
  stations: readonly Station[]
  byId: ReadonlyMap<string, Station>
  /** Stations sharing one name (only names used more than once). */
  sameName: ReadonlyMap<string, readonly Station[]>
  /** normalizeStationText(name) of stations[i]. */
  keys: readonly string[]
}

export const SUGGEST_STATION_LIMIT = 8
/** Shown for a saved station id that the master does not have. */
export const MISSING_STATION_NAME = '（見つからない駅）'

export function buildCityMap(table: CityTable): CityMap {
  return new Map(PREFECTURES.map((p, i) => [p, table[i] ?? []]))
}

/** Municipalities of a prefecture in code order ([] for an unknown / empty prefecture). */
export function citiesOf(cities: CityMap, prefecture: string | undefined): readonly string[] {
  return (prefecture && cities.get(prefecture)) || []
}

export function buildStationMaster(stations: StationTable, cities: CityTable): StationMaster {
  const list: Station[] = []
  PREFECTURES.forEach((prefecture, p) => {
    for (const [id, name, c] of stations[p] ?? []) {
      const city = c >= 0 ? cities[p]?.[c] : undefined
      list.push(city ? { id, name, prefecture, city } : { id, name, prefecture })
    }
  })
  const byName = new Map<string, Station[]>()
  for (const s of list) byName.set(s.name, [...(byName.get(s.name) ?? []), s])
  return {
    stations: list,
    byId: new Map(list.map((s) => [s.id, s])),
    sameName: new Map([...byName].filter(([, l]) => l.length > 1)),
    keys: list.map((s) => normalizeStationText(s.name)),
  }
}

/** Station of an id, or undefined (unknown ids never throw). */
export function findStation(master: StationMaster, id: string | undefined): Station | undefined {
  return id ? master.byId.get(id) : undefined
}

/** For matching only: NFKC, no white space, ヶ = ケ. */
export function normalizeStationText(s: string): string {
  return s.normalize('NFKC').replace(/\s+/g, '').replace(/ヶ/g, 'ケ')
}

/** What the user typed, for matching: normalized and without a trailing "駅". */
export function stationQuery(input: string): string {
  return normalizeStationText(input).replace(/駅$/, '')
}

/** Only hiragana / katakana (and ー). The free station data has no readings, so these rarely match. */
export function isKanaOnly(input: string): boolean {
  const s = normalizeStationText(input)
  return s !== '' && /^[ぁ-ゖァ-ヺーゝゞヽヾ]+$/.test(s)
}

const prefIndex = (p: string) => {
  const i = PREFECTURES.indexOf(p)
  return i < 0 ? PREFECTURES.length : i
}
// numeric ids (ekidata) first in number order, then x01...
const idCompare = (a: string, b: string) => {
  const xa = !/^\d+$/.test(a)
  const xb = !/^\d+$/.test(b)
  if (xa !== xb) return xa ? 1 : -1
  if (!xa) return Number(a) - Number(b)
  return a < b ? -1 : a > b ? 1 : 0
}

/**
 * Up to `limit` stations for the typed text: prefix matches, then other partial matches. In each
 * group: stations of `prefecture` first, then shorter names, then prefecture order, then id.
 * Empty input -> [].
 */
export function suggestStations(master: StationMaster, input: string, prefecture?: string, limit = SUGGEST_STATION_LIMIT): Station[] {
  const q = stationQuery(input)
  if (q === '') return []
  const hits: { s: Station; rank: number; len: number }[] = []
  master.stations.forEach((s, i) => {
    const pos = master.keys[i].indexOf(q)
    if (pos >= 0) hits.push({ s, rank: pos === 0 ? 0 : 1, len: master.keys[i].length })
  })
  const home = (s: Station) => (prefecture && s.prefecture === prefecture ? 0 : 1)
  hits.sort(
    (a, b) =>
      a.rank - b.rank ||
      home(a.s) - home(b.s) ||
      a.len - b.len ||
      prefIndex(a.s.prefecture) - prefIndex(b.s.prefecture) ||
      idCompare(a.s.id, b.s.id),
  )
  return hits.slice(0, limit).map((h) => h.s)
}

/** "富山駅". Names that already end with 駅 / 駅前 / ステーション are kept as they are (駅前: construction 7a). */
export function stationLabel(s: Pick<Station, 'name'>): string {
  return /(駅|駅前|ステーション)$/.test(s.name) ? s.name : `${s.name}駅`
}

/**
 * Name for candidates and the filter panel: "府中駅（東京都）" only when another prefecture has a
 * station of the same name; "〇〇駅（〇〇市）" when the same prefecture has one; else "富山駅".
 */
export function stationChoiceLabel(master: StationMaster, s: Station): string {
  const same = master.sameName.get(s.name)
  const label = stationLabel(s)
  if (!same) return label
  if (same.some((o) => o !== s && o.prefecture === s.prefecture)) return `${label}（${s.city ?? s.prefecture}）`
  if (same.some((o) => o.prefecture !== s.prefecture)) return `${label}（${s.prefecture}）`
  return label
}

/** "富山県富山市" (the small text of a candidate). */
export function stationLocation(s: Station): string {
  return s.prefecture + (s.city ?? '')
}

export interface PlaceValues {
  /** '' = not chosen. */
  prefecture: string
  city: string
}

/**
 * After picking a station: an empty prefecture gets the station's; an empty city gets the
 * station's city when the prefecture (after that) is the station's. Values already set are
 * never overwritten.
 */
export function autofillPlace(cur: PlaceValues, s: Station): PlaceValues {
  const prefecture = cur.prefecture || s.prefecture
  const city = cur.city || (prefecture === s.prefecture && s.city ? s.city : '')
  return { prefecture, city }
}
