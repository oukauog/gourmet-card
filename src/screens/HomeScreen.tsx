import { lazy, Suspense, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { FilterChips, type FilterPanelKind } from '../components/filter/FilterChips'
import { FilterPanel, type PanelKind } from '../components/filter/FilterPanel'
import { ListTabs } from '../components/filter/ListTabs'
import { pageScrollY } from '../components/filter/scrollLock'
import { SORT_LABELS } from '../components/filter/sortLabels'
import { SelectHeader } from '../components/select/SelectHeader'
import { SelectSendBar } from '../components/select/SelectSendBar'
import { useShopSelection } from '../components/select/useShopSelection'
import { SendSheet } from '../components/share/SendSheet'
import { ShopTile } from '../components/ShopTile'
import { exportShopsCard } from '../db/exportCards'
import { getPhoto } from '../db/photos'
import { getSetting, setSetting } from '../db/settings'
import { listShops } from '../db/shops'
import { listTags } from '../db/tags'
import type { Shop, ShopStatus, SortOrder } from '../db/types'
import { useStationMaster } from '../hooks/useGeoMaster'
import { CARD_FILE_TYPE } from '../lib/cardFileType'
import { findStation, stationChoiceLabel, stationLabel } from '../lib/geo'
import {
  emptyFilter,
  filterChipLabels,
  filterOptions,
  isFilterActive,
  matchesFilter,
  resultCountText,
  setUnratedOnly,
  type ShopFilter,
  type StationLookup,
} from '../lib/shopFilter'
import { allShownSelected, existingSelection, hiddenSelectedCount, sendOrder } from '../lib/shopSelection'
import '../styles/home.css'
import '../styles/filter.css'
import '../styles/data.css'

interface Props {
  onAdd: () => void
  /** The menu button: "バックアップと取り込み" (construction 8). */
  onOpenData?: () => void
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

/**
 * Forget the list kept in memory (after an import, construction 8), so the next visit shows
 * fresh data. With a tab: open the list there, without a filter, at the top.
 */
// must live next to the module variables it resets
// oxlint-disable-next-line react/only-export-components
export function resetListView(tab?: ShopStatus): void {
  lastData = undefined
  if (tab) {
    lastTab = tab
    lastFilter = emptyFilter()
    lastScrollY = 0
  }
}

export function HomeScreen({ onAdd, onOpenShop, onOpenData }: Props) {
  const [data, setData] = useState<ListData | undefined>(lastData)
  const [columns, setColumns] = useState<Columns | undefined>(lastColumns)
  const [sort, setSort] = useState<SortOrder | undefined>(lastSort)
  const [tab, setTab] = useState<ShopStatus>(lastTab)
  const [filter, setFilter] = useState<ShopFilter>(lastFilter)
  const [panel, setPanel] = useState<PanelKind>()
  // selection mode (construction 8b): screen state only
  const selection = useShopSelection()
  const [sendIds, setSendIds] = useState<string[]>()
  const delivered = useRef(false)
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
  // the station master is read only when a shop of this tab has a station (construction 7);
  // until it is loaded the panel has no station section
  const tabHasStation = (data?.rows ?? []).some((r) => r.shop.status === tab && r.shop.stationId !== undefined)
  const master = useStationMaster(tabHasStation || filter.stationIds.length > 0)
  const stationMaster = master.state === 'ready' ? master.value : undefined
  const stations = useMemo<StationLookup | undefined>(() => {
    if (!stationMaster) return undefined
    const at = (id: string) => findStation(stationMaster, id)
    return {
      name: (id) => {
        const s = at(id)
        return s && stationChoiceLabel(stationMaster, s)
      },
      prefecture: (id) => at(id)?.prefecture,
    }
  }, [stationMaster])
  const stationShortName = useCallback(
    (id: string) => {
      const s = stationMaster && findStation(stationMaster, id)
      return s && stationLabel(s)
    },
    [stationMaster],
  )
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
        stations,
      ),
    }
  }, [data, tab, filter, tagName, stations])
  const labels = filterChipLabels(filter, tagName, stationShortName)
  const active = isFilterActive(filter)
  const clearFilter = () => changeFilter(emptyFilter())

  const ready = data !== undefined && columns !== undefined
  const cols = columns ?? DEFAULT_COLUMNS
  const nextCols: Columns = cols === 3 ? 2 : 3
  const gridStyle = { '--cols': cols } as CSSProperties
  const tabTotal = view.tabRows.length

  const allIds = (data?.rows ?? []).map((r) => r.shop.id)
  const shownIds = view.shown.map((r) => r.shop.id)
  const selected = existingSelection(selection.selected, allIds)
  const openSend = () => {
    delivered.current = false
    setSendIds(sendOrder(selected, allIds))
  }
  const closeSend = () => {
    setSendIds(undefined)
    // sent (shared or saved): back to the normal list; closed without sending: keep selecting
    if (delivered.current) selection.finish()
  }

  return (
    <div className={`screen home-screen cols-${cols}${selection.selecting ? ' selecting' : ''}`}>
      {selection.selecting ? (
        <SelectHeader count={selected.length} onCancel={selection.finish} />
      ) : (
      <header className="topbar home-topbar">
        <h1 className="topbar-title home-title">グルメカード</h1>
        <div className="home-topbar-actions">
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
          {/* narrower than 390px the bar does not fit: then "選ぶ" is in the count row (select.css) */}
          <button type="button" className="btn select-toggle select-toggle-top" onClick={selection.start} disabled={!ready}>
            選ぶ
          </button>
          {onOpenData && (
            <button type="button" className="btn menu-button" aria-label="メニュー" onClick={onOpenData}>
              <svg className="menu-icon" viewBox="0 0 24 24" aria-hidden="true">
                <path d="M4 7h16M4 12h16M4 17h16" />
              </svg>
            </button>
          )}
        </div>
      </header>
      )}

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
          {selection.selecting && shownIds.length > 0 && (
            <button
              type="button"
              className="list-select-all"
              onClick={() => (allShownSelected(selected, shownIds) ? selection.unselectShown(shownIds) : selection.selectShown(shownIds))}
            >
              {allShownSelected(selected, shownIds) ? '表示中をすべて外す' : '表示中をすべて選ぶ'}
            </button>
          )}
          {!selection.selecting && (
            <button type="button" className="list-select select-toggle-row" onClick={selection.start}>
              選ぶ
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
              <ShopTile
                shop={shop}
                cover={cover}
                onOpen={onOpenShop}
                selection={selection.selecting ? { selected: selected.includes(shop.id), onToggle: selection.toggle } : undefined}
              />
            </li>
          ))}
      </ul>

      {DevSampleBar && (
        <Suspense fallback={null}>
          <DevSampleBar onDataChanged={() => void load(sort ?? DEFAULT_SORT)} />
        </Suspense>
      )}

      {selection.selecting ? (
        <SelectSendBar count={selected.length} hidden={hiddenSelectedCount(selected, shownIds)} onSend={openSend} />
      ) : (
        <button type="button" className="fab" aria-label="お店を登録" onClick={onAdd}>
          ＋
        </button>
      )}

      {sendIds && (
        <SendSheet
          title={`${sendIds.length}店を送る`}
          prepare={(onProgress) => exportShopsCard(sendIds, CARD_FILE_TYPE, onProgress)}
          onDelivered={() => {
            delivered.current = true
          }}
          onClose={closeSend}
        />
      )}

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
