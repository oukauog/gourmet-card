import type { SortOrder } from '../../db/types'
import { ratingToText } from '../../lib/rating'
import {
  clearFilterLists,
  MIN_RATING_CHOICES,
  setMinRating,
  toggleFilterValue,
  type FilterListKey,
  type FilterOption,
  type FilterOptions,
  type ShopFilter,
} from '../../lib/shopFilter'
import { BottomSheet } from './BottomSheet'
import type { FilterPanelKind } from './FilterChips'
import { SORT_LABELS, SORT_ORDER_CHOICES } from './sortLabels'

export type PanelKind = FilterPanelKind | 'sort'

interface Section {
  /** Heading of the section (only when the panel has several). */
  title?: string
  key: FilterListKey
  options: FilterOption[]
}

/**
 * Sections of each list panel. "場所" = prefecture + area; city / station sections come in
 * construction 7 (add them here).
 */
function sectionsOf(kind: 'place' | 'genre' | 'use', o: FilterOptions): Section[] {
  const all: Record<typeof kind, Section[]> = {
    place: [
      { title: '県', key: 'prefectures', options: o.prefectures },
      { title: 'エリア', key: 'areaTagIds', options: o.areas },
    ],
    genre: [{ key: 'genreTagIds', options: o.genres }],
    use: [{ key: 'useTagIds', options: o.uses }],
  }
  // a section without candidates is not shown
  return all[kind].filter((s) => s.options.length > 0)
}

const PANEL_TITLES: Record<PanelKind, string> = { place: '場所', genre: 'ジャンル', use: '使い道', rating: '評価', sort: '並び順' }

interface Props {
  kind: PanelKind
  filter: ShopFilter
  options: FilterOptions
  /** Shops shown with the current filter (for "N件を表示"). */
  shownCount: number
  sort: SortOrder
  onFilterChange: (f: ShopFilter) => void
  onSortChange: (s: SortOrder) => void
  onClose: () => void
}

/** The panel for one chip (or the sort order). Changes apply to the list right away. */
export function FilterPanel({ kind, filter, options, shownCount, sort, onFilterChange, onSortChange, onClose }: Props) {
  const title = PANEL_TITLES[kind]

  if (kind === 'sort') {
    return (
      <BottomSheet title={title} onClose={onClose}>
        <div className="sheet-options" role="radiogroup" aria-label={title}>
          {SORT_ORDER_CHOICES.map((s) => (
            <button
              key={s}
              type="button"
              role="radio"
              aria-checked={sort === s}
              className="option-chip"
              onClick={() => {
                onSortChange(s)
                onClose()
              }}
            >
              {SORT_LABELS[s]}
            </button>
          ))}
        </div>
      </BottomSheet>
    )
  }

  const footer = (
    <button type="button" className="btn btn-primary btn-block" onClick={onClose}>
      {shownCount}件を表示
    </button>
  )

  if (kind === 'rating') {
    const choices: (number | undefined)[] = [undefined, ...MIN_RATING_CHOICES]
    return (
      <BottomSheet title={title} onClose={onClose} footer={footer}>
        <div className="sheet-options" role="radiogroup" aria-label={title}>
          {choices.map((r) => (
            <button
              key={r ?? 'none'}
              type="button"
              role="radio"
              aria-checked={filter.minRating === r}
              className="option-chip"
              onClick={() => onFilterChange(setMinRating(filter, r))}
            >
              {r === undefined ? '指定なし' : `${ratingToText(r)}以上`}
            </button>
          ))}
        </div>
      </BottomSheet>
    )
  }

  const sections = sectionsOf(kind, options)
  const keys = kind === 'place' ? (['prefectures', 'areaTagIds'] as const) : kind === 'genre' ? (['genreTagIds'] as const) : (['useTagIds'] as const)
  const anyChosen = keys.some((k) => filter[k].length > 0)
  const clear = (
    <button type="button" className="sheet-clear" disabled={!anyChosen} onClick={() => onFilterChange(clearFilterLists(filter, keys))}>
      クリア
    </button>
  )

  return (
    <BottomSheet title={title} onClose={onClose} headerAction={clear} footer={footer}>
      {sections.length === 0 && <p className="sheet-empty">まだありません</p>}
      {sections.map((s) => (
        <section key={s.key} className="sheet-section" aria-label={s.title ?? title}>
          {s.title && <h3 className="sheet-section-title">{s.title}</h3>}
          <div className="sheet-options">
            {s.options.map((o) => (
              <button
                key={o.value}
                type="button"
                className="option-chip"
                aria-pressed={o.selected}
                onClick={() => onFilterChange(toggleFilterValue(filter, s.key, o.value))}
              >
                {o.name}
                <span className="option-count">{o.count}</span>
              </button>
            ))}
          </div>
        </section>
      ))}
    </BottomSheet>
  )
}
