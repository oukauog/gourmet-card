// List filter (spec 4.1.1, construction 6). Pure: works on shops already read into memory.
//   prefecture / area / genre: ANY of the chosen ones     use: ALL of the chosen ones
//   different kinds: AND      rating: rating >= minRating (unrated shops never match)
//   unratedOnly: only shops without a rating (never together with minRating)
import { ratingToText } from './rating'

export interface ShopFilter {
  prefectures: string[]
  areaTagIds: string[]
  genreTagIds: string[]
  useTagIds: string[]
  /** Integer 1..50 (the panel offers 30 / 35 / 40 / 45). */
  minRating?: number
  unratedOnly: boolean
}

/** The fields of a shop that the filter looks at. */
export interface FilterableShop {
  prefecture?: string
  rating?: number
  areaTagIds: readonly string[]
  genreTagIds: readonly string[]
  useTagIds: readonly string[]
}

export type FilterListKey = 'prefectures' | 'areaTagIds' | 'genreTagIds' | 'useTagIds'

export const MIN_RATING_CHOICES: readonly number[] = [30, 35, 40, 45]

export function emptyFilter(): ShopFilter {
  return { prefectures: [], areaTagIds: [], genreTagIds: [], useTagIds: [], unratedOnly: false }
}

/** True when any condition is set. */
export function isFilterActive(f: ShopFilter): boolean {
  return (
    f.prefectures.length > 0 ||
    f.areaTagIds.length > 0 ||
    f.genreTagIds.length > 0 ||
    f.useTagIds.length > 0 ||
    f.minRating !== undefined ||
    f.unratedOnly
  )
}

export function matchesFilter(s: FilterableShop, f: ShopFilter): boolean {
  if (f.prefectures.length > 0 && !(s.prefecture !== undefined && f.prefectures.includes(s.prefecture))) return false
  if (f.areaTagIds.length > 0 && !f.areaTagIds.some((id) => s.areaTagIds.includes(id))) return false
  if (f.genreTagIds.length > 0 && !f.genreTagIds.some((id) => s.genreTagIds.includes(id))) return false
  if (!f.useTagIds.every((id) => s.useTagIds.includes(id))) return false
  if (f.unratedOnly) return s.rating === undefined
  if (f.minRating !== undefined) return s.rating !== undefined && s.rating >= f.minRating
  return true
}

/** Shops that match, in the given order. */
export function filterShops<T extends FilterableShop>(shops: readonly T[], f: ShopFilter): T[] {
  return shops.filter((s) => matchesFilter(s, f))
}

/** Add the value if absent, remove it if present (keeps the order of choosing). */
export function toggleFilterValue(f: ShopFilter, key: FilterListKey, value: string): ShopFilter {
  const list = f[key]
  return { ...f, [key]: list.includes(value) ? list.filter((v) => v !== value) : [...list, value] }
}

/** Set (or clear with undefined) the minimum rating. Turns "未評価のみ" off. */
export function setMinRating(f: ShopFilter, minRating: number | undefined): ShopFilter {
  const next: ShopFilter = { ...f, unratedOnly: minRating === undefined ? f.unratedOnly : false }
  if (minRating === undefined) delete next.minRating
  else next.minRating = minRating
  return next
}

/** Turn "未評価のみ" on / off. Turning it on clears the minimum rating. */
export function setUnratedOnly(f: ShopFilter, on: boolean): ShopFilter {
  const next: ShopFilter = { ...f, unratedOnly: on }
  if (on) delete next.minRating
  return next
}

/** Clear the given lists (e.g. the "場所" panel clears prefectures and areas). */
export function clearFilterLists(f: ShopFilter, keys: readonly FilterListKey[]): ShopFilter {
  const next = { ...f }
  for (const k of keys) next[k] = []
  return next
}

// ---------- panel candidates ----------

export interface FilterOption {
  /** Prefecture name or tag id. */
  value: string
  name: string
  /** Shops (of the given list) that have it. */
  count: number
  selected: boolean
}

export interface FilterOptions {
  prefectures: FilterOption[]
  areas: FilterOption[]
  genres: FilterOption[]
  uses: FilterOption[]
}

const jaCollator = new Intl.Collator('ja')
export const MISSING_TAG_NAME = '（削除されたタグ）'

/**
 * Candidates for the panels from `shops` (the shops of the current tab; the filter itself is
 * ignored): values used by at least one shop, with counts, most used first, ties by name.
 * Chosen values stay even with 0 shops (so they can be taken off). Unknown tag ids on shops are
 * skipped; a chosen unknown id is shown as MISSING_TAG_NAME.
 */
export function filterOptions(
  shops: readonly FilterableShop[],
  f: ShopFilter,
  tagName: (id: string) => string | undefined,
): FilterOptions {
  const build = (values: (s: FilterableShop) => readonly string[], chosen: readonly string[], nameOf: (v: string) => string | undefined) => {
    const counts = new Map<string, number>()
    for (const s of shops) for (const v of new Set(values(s))) counts.set(v, (counts.get(v) ?? 0) + 1)
    for (const v of chosen) if (!counts.has(v)) counts.set(v, 0)
    const out: FilterOption[] = []
    for (const [value, count] of counts) {
      const selected = chosen.includes(value)
      const name = nameOf(value) ?? (selected ? MISSING_TAG_NAME : undefined)
      if (name !== undefined) out.push({ value, name, count, selected })
    }
    return out.sort((a, b) => b.count - a.count || jaCollator.compare(a.name, b.name))
  }
  return {
    prefectures: build((s) => (s.prefecture ? [s.prefecture] : []), f.prefectures, (v) => v),
    areas: build((s) => s.areaTagIds, f.areaTagIds, tagName),
    genres: build((s) => s.genreTagIds, f.genreTagIds, tagName),
    uses: build((s) => s.useTagIds, f.useTagIds, tagName),
  }
}

// ---------- chip text ----------

export const FILTER_KIND_LABELS = { place: '場所', genre: 'ジャンル', use: '使い道', rating: '評価' } as const

/** "場所" (none) / "ラーメン" (one) / "ラーメン ほか1" (two or more). */
export function namesLabel(kindLabel: string, names: readonly string[]): string {
  if (names.length === 0) return kindLabel
  if (names.length === 1) return names[0]
  return `${names[0]} ほか${names.length - 1}`
}

/** "4.0以上" (or "評価" when not set). */
export function ratingChipLabel(minRating: number | undefined): string {
  return minRating === undefined ? FILTER_KIND_LABELS.rating : `${ratingToText(minRating)}以上`
}

/** Text of each chip. "場所" counts prefectures and areas together (prefectures first). */
export function filterChipLabels(f: ShopFilter, tagName: (id: string) => string | undefined) {
  const names = (ids: readonly string[]) => ids.map((id) => tagName(id) ?? MISSING_TAG_NAME)
  return {
    place: namesLabel(FILTER_KIND_LABELS.place, [...f.prefectures, ...names(f.areaTagIds)]),
    genre: namesLabel(FILTER_KIND_LABELS.genre, names(f.genreTagIds)),
    use: namesLabel(FILTER_KIND_LABELS.use, names(f.useTagIds)),
    rating: ratingChipLabel(f.minRating),
  }
}

/** "12件" / "3件（12件中）". */
export function resultCountText(shown: number, total: number, active: boolean): string {
  return active ? `${shown}件（${total}件中）` : `${total}件`
}
