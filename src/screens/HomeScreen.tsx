import { lazy, Suspense, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { FilterChips, type FilterPanelKind } from '../components/filter/FilterChips'
import { FilterPanel, type PanelKind } from '../components/filter/FilterPanel'
import { ListTabs } from '../components/filter/ListTabs'
import { pageScrollY } from '../components/filter/scrollLock'
import { SORT_LABELS } from '../components/filter/sortLabels'
import { ShopTile } from '../components/ShopTile'
import { getPhoto } from '../db/photos'
import { getSetting, setSetting } from '../db/settings'
import { listShops } from '../db/shops'
import { listTags } from '../db/tags'
import type { Shop, ShopStatus, SortOrder } from '../db/types'
import {
  emptyFilter,
  filterChipLabels,
  filterOptions,
  isFilterActive,
  matchesFilter,
  resultCountText,
  setUnratedOnly,
  type ShopFilter,
} from '../lib/shopFilter'
import '../styles/home.css'
import '../styles/filter.css'

interface Props {
  onAdd: () => void
  onOpenShop: (shopId: string) => void
}

interface Row {
  shop: Shop
  /** Cover photo's SMALL image only. */
  cover?: Blob
}

interface ListData {
  /** Every shop of both tabs, in the sort order. */
  rows: Row[]
  tagNames: Map<string, string>
}

type Columns = 2 | 3
const DEFAULT_COLUMNS: Columns = 3
const DEFAULT_SORT: SortOrder = 'newest'
const SKELETON_COUNT = 9

// DEV only: sample data buttons. Loaded lazily and only in dev, so neither its JS nor its CSS
// is part of the production build.
const DevSampleBar = import.meta.env.DEV
  ? lazy(() => import('../dev/DevSampleBar').then((m) => ({ default: m.DevSampleBar })))
  : null

// Kept while the app runs, so coming back from a shop page shows the list at once (no blank /
// skeleton flash) at the same place, with the same tab and filter, while a fresh load runs in
// the background. The tab and the filter are NOT saved: a reload starts at "手札, no filter"
// (spec 4.1.1). The sort order is saved in settings.
let lastData: ListData | undefined
let lastColumns: Columns | undefined
let lastSort: SortOrder | undefined
let lastScrollY = 0
let lastTab: ShopStatus = 'visited'
let lastFilter: ShopFilter = emptyFilter()

/** All shops (both tabs) once, with their small covers, and the tag names. */
async function loadList(sort: SortOrder): Promise<ListData> {
  const [shops, tags] = await Promise.all([listShops({ sort }), listTags()])
  const rows = await Promise.all(
    shops.map(async (shop) => ({
      shop,
      cover: shop.photoIds[0] ? (await getPhoto(shop.photoIds[0]))?.small : undefined,
    })),
  )
  return { rows, tagNames: new Map(tags.map((t) => [t.id, t.name])) }
}

export function HomeScreen({ onAdd, onOpenShop }: Props) {
  const [data, setData] = useState<ListData | undefined>(lastData)
  const [columns, setColumns] = useState<Columns | undefined>(lastColumns)
  const [sort, setSort] = useState<SortOrder | undefined>(lastSort)
  const [tab, setTab] = useState<ShopStatus>(lastTab)
  const [filter, setFilter] = useState<ShopFilter>(lastFilter)
  const [panel, setPanel] = useState<PanelKind>()
  // only the newest load may set the data (sort changes can overlap)
  const loadSeq = useRef(0)

  const load = useCallback(async (s: SortOrder) => {
    const seq = ++loadSeq.current
    const next = await loadList(s)
    if (seq !== loadSeq.current) return
    lastData = next
    setData(next)
  }, [])

  useEffect(() => {
    let active = true
    ;(async () => {
      const s = lastSort ?? (await getSetting('sortOrder')) ?? DEFAULT_SORT
      lastSort = s
      if (!active) return
      setSort(s)
      await load(s)
    })()
    getSetting('columns').then((c) => {
      lastColumns = c ?? DEFAULT_COLUMNS
      if (active) setColumns(lastColumns)
    })
    return () => {
      active = false
    }
  }, [load])

  // Restore the scroll position when the cached list is shown; remember it on leave.
  useLayoutEffect(() => {
    if (lastData) window.scrollTo(0, lastScrollY)
    return () => {
      lastScrollY = pageScrollY()
    }
  }, [])

  const toggleColumns = () => {
    const next: Columns = (columns ?? DEFAULT_COLUMNS) === 3 ? 2 : 3
    lastColumns = next
    setColumns(next)
    void setSetting('columns', next)
  }

  const changeTab = (t: ShopStatus) => {
    if (t === tab) return
    lastTab = t
    setTab(t)
    window.scrollTo(0, 0)
  }
  const changeFilter = (f: ShopFilter) => {
    lastFilter = f
    setFilter(f)
  }
  const changeSort = (s: SortOrder) => {
    if (s === sort) return
    lastSort = s
    setSort(s)
    void setSetting('sortOrder', s)
    void load(s)
  }

  const tagName = useCallback((id: string) => data?.tagNames.get(id), [data])
  const view = useMemo(() => {
    const rows = data?.rows ?? []
    const tabRows = rows.filter((r) => r.shop.status === tab)
    return {
      counts: {
        visited: rows.filter((r) => r.shop.status === 'visited').length,
        wishlist: rows.filter((r) => r.shop.status === 'wishlist').length,
      },
      tabRows,
      shown: tabRows.filter((r) => matchesFilter(r.shop, filter)),
      options: filterOptions(
        tabRows.map((r) => r.shop),
        filter,
        tagName,
      ),
    }
  }, [data, tab, filter, tagName])
  const labels = filterChipLabels(filter, tagName)
  const active = isFilterActive(filter)
  const clearFilter = () => changeFilter(emptyFilter())

  const ready = data !== undefined && columns !== undefined
  const cols = columns ?? DEFAULT_COLUMNS
  const nextCols: Columns = cols === 3 ? 2 : 3
  const gridStyle = { '--cols': cols } as CSSProperties
  const tabTotal = view.tabRows.length

  return (
    <div className={`screen home-screen cols-${cols}`}>
      <header className="topbar home-topbar">
        <h1 className="topbar-title home-title">グルメカード</h1>
        <button
          type="button"
          className="btn cols-toggle"
          aria-label={`${nextCols}列表示に切り替え`}
          onClick={toggleColumns}
          disabled={columns === undefined}
        >
          {/* shows the RESULT of tapping (the next column count) */}
          <ColumnsIcon cols={nextCols} />
          <span>{nextCols}列にする</span>
        </button>
      </header>

      <ListTabs value={tab} counts={view.counts} onChange={changeTab} />

      <FilterChips
        filter={filter}
        labels={labels}
        onOpen={(k: FilterPanelKind) => setPanel(k)}
        onToggleUnrated={() => changeFilter(setUnratedOnly(filter, !filter.unratedOnly))}
      />

      {ready && tabTotal > 0 && (
        <div className="list-meta">
          <span className="list-count" data-testid="list-count">
            {resultCountText(view.shown.length, tabTotal, active)}
          </span>
          {active && (
            <button type="button" className="list-clear" onClick={clearFilter}>
              条件を解除
            </button>
          )}
          <button type="button" className="list-sort" aria-haspopup="dialog" onClick={() => setPanel('sort')}>
            {SORT_LABELS[sort ?? DEFAULT_SORT]}
            <span aria-hidden="true"> ▾</span>
          </button>
        </div>
      )}

      {ready && tabTotal === 0 && (
        <p className="empty">{tab === 'visited' ? '＋から最初のお店を登録' : '行きたいお店はまだありません'}</p>
      )}
      {ready && tabTotal > 0 && view.shown.length === 0 && (
        <div className="list-nomatch">
          <p>条件に合うお店がありません</p>
          <button type="button" className="btn btn-secondary" onClick={clearFilter}>
            条件を解除
          </button>
        </div>
      )}

      <ul className="tile-grid" style={gridStyle} data-testid="tile-grid" data-cols={cols} aria-busy={!ready}>
        {!ready && Array.from({ length: SKELETON_COUNT }, (_, i) => <li key={i} className="tile-skeleton" aria-hidden="true" />)}
        {ready &&
          view.shown.map(({ shop, cover }) => (
            <li key={shop.id} className="tile-cell">
              <ShopTile shop={shop} cover={cover} onOpen={onOpenShop} />
            </li>
          ))}
      </ul>

      {DevSampleBar && (
        <Suspense fallback={null}>
          <DevSampleBar onDataChanged={() => void load(sort ?? DEFAULT_SORT)} />
        </Suspense>
      )}

      <button type="button" className="fab" aria-label="お店を登録" onClick={onAdd}>
        ＋
      </button>

      {panel && (
        <FilterPanel
          kind={panel}
          filter={filter}
          options={view.options}
          shownCount={view.shown.length}
          sort={sort ?? DEFAULT_SORT}
          onFilterChange={changeFilter}
          onSortChange={changeSort}
          onClose={() => setPanel(undefined)}
        />
      )}
    </div>
  )
}

/** Small grid icon with `cols` x `cols` cells. */
function ColumnsIcon({ cols }: { cols: Columns }) {
  const size = cols === 3 ? 4 : 6.5
  const gap = cols === 3 ? 1.5 : 2
  const cells = []
  for (let r = 0; r < cols; r++)
    for (let c = 0; c < cols; c++)
      cells.push(<rect key={`${r}-${c}`} x={c * (size + gap)} y={r * (size + gap)} width={size} height={size} rx="1" />)
  return (
    <svg className="cols-icon" viewBox="0 0 15 15" aria-hidden="true">
      {cells}
    </svg>
  )
}
