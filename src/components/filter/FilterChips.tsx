import type { ShopFilter } from '../../lib/shopFilter'

export type FilterPanelKind = 'place' | 'genre' | 'use' | 'rating'

interface Props {
  filter: ShopFilter
  labels: Record<FilterPanelKind, string>
  onOpen: (kind: FilterPanelKind) => void
  onToggleUnrated: () => void
}

/** Horizontal chip row: 場所 / ジャンル / 使い道 / 評価 (open a panel) and 未評価のみ (on/off). */
export function FilterChips({ filter, labels, onOpen, onToggleUnrated }: Props) {
  const active: Record<FilterPanelKind, boolean> = {
    place: filter.prefectures.length > 0 || filter.areaTagIds.length > 0,
    genre: filter.genreTagIds.length > 0,
    use: filter.useTagIds.length > 0,
    rating: filter.minRating !== undefined,
  }
  const kinds: FilterPanelKind[] = ['place', 'genre', 'use', 'rating']
  return (
    <div className="filter-chips" role="toolbar" aria-label="絞り込み" data-testid="filter-chips">
      {kinds.map((k) => (
        <button
          key={k}
          type="button"
          className="filter-chip"
          data-kind={k}
          data-active={active[k]}
          aria-haspopup="dialog"
          onClick={() => onOpen(k)}
        >
          <span className="filter-chip-text">{labels[k]}</span>
          <span className="filter-chip-caret" aria-hidden="true">
            ▾
          </span>
        </button>
      ))}
      <button type="button" className="filter-chip" data-kind="unrated" data-active={filter.unratedOnly} aria-pressed={filter.unratedOnly} onClick={onToggleUnrated}>
        未評価のみ
      </button>
    </div>
  )
}
