import type { ShopStatus } from '../../db/types'

interface Props {
  value: ShopStatus
  /** Shops per tab before filtering. */
  counts: Record<ShopStatus, number>
  onChange: (tab: ShopStatus) => void
}

const TABS: { value: ShopStatus; label: string }[] = [
  { value: 'visited', label: '手札' },
  { value: 'wishlist', label: '行きたい' },
]

/** "手札 12" / "行きたい 3" (segmented). */
export function ListTabs({ value, counts, onChange }: Props) {
  return (
    <div className="list-tabs" role="tablist" aria-label="手札／行きたい">
      {TABS.map((t) => (
        <button
          key={t.value}
          type="button"
          role="tab"
          aria-selected={value === t.value}
          className="list-tab"
          onClick={() => onChange(t.value)}
        >
          {t.label}
          <span className="list-tab-count">{counts[t.value]}</span>
        </button>
      ))}
    </div>
  )
}
