import { useCallback, useEffect, useLayoutEffect, useState, type CSSProperties } from 'react'
import { ShopTile } from '../components/ShopTile'
import { getPhoto } from '../db/photos'
import { getSetting, setSetting } from '../db/settings'
import { listShops } from '../db/shops'
import type { Shop } from '../db/types'
import { DevSampleBar } from '../dev/DevSampleBar'
import { loadTileVariant, saveTileVariant, type TileVariant } from '../dev/sampleVariant'
import '../styles/home.css'

interface Props {
  onAdd: () => void
  onOpenShop: (shopId: string) => void
}

interface Row {
  shop: Shop
  /** Cover photo's SMALL image only. */
  cover?: Blob
}

type Columns = 2 | 3
const DEFAULT_COLUMNS: Columns = 3
const SKELETON_COUNT = 9

// Last list and scroll position, so coming back from a shop page shows the list at once
// (no blank / skeleton flash) at the same place, while a fresh load runs in the background.
let lastRows: Row[] | undefined
let lastColumns: Columns | undefined
let lastScrollY = 0

async function loadRows(): Promise<Row[]> {
  const shops = await listShops()
  return Promise.all(
    shops.map(async (shop) => ({
      shop,
      cover: shop.photoIds[0] ? (await getPhoto(shop.photoIds[0]))?.small : undefined,
    })),
  )
}

export function HomeScreen({ onAdd, onOpenShop }: Props) {
  const [rows, setRows] = useState<Row[] | undefined>(lastRows)
  const [columns, setColumns] = useState<Columns | undefined>(lastColumns)
  // Look comparison (DEV only; fixed in construction 3a). Production always uses a1.
  const [variant, setVariant] = useState<TileVariant>(() => (import.meta.env.DEV ? loadTileVariant() : 'a1'))

  const reload = useCallback(async () => {
    const next = await loadRows()
    lastRows = next
    setRows(next)
  }, [])

  useEffect(() => {
    let active = true
    loadRows().then((next) => {
      lastRows = next
      if (active) setRows(next)
    })
    getSetting('columns').then((c) => {
      lastColumns = c ?? DEFAULT_COLUMNS
      if (active) setColumns(lastColumns)
    })
    return () => {
      active = false
    }
  }, [])

  // Restore the scroll position when the cached list is shown; remember it on leave.
  useLayoutEffect(() => {
    if (lastRows) window.scrollTo(0, lastScrollY)
    return () => {
      lastScrollY = window.scrollY
    }
  }, [])

  const toggleColumns = () => {
    const next: Columns = (columns ?? DEFAULT_COLUMNS) === 3 ? 2 : 3
    lastColumns = next
    setColumns(next)
    void setSetting('columns', next)
  }

  const changeVariant = (v: TileVariant) => {
    setVariant(v)
    saveTileVariant(v)
  }

  const cols = columns ?? DEFAULT_COLUMNS
  const gridStyle = { '--cols': cols } as CSSProperties

  return (
    <div className={`screen home-screen tiles-${variant} cols-${cols}`}>
      <header className="topbar home-topbar">
        <h1 className="topbar-title home-title">グルメカード</h1>
        <button
          type="button"
          className="btn cols-toggle"
          aria-label={`${cols === 3 ? 2 : 3}列表示に切り替え`}
          onClick={toggleColumns}
          disabled={columns === undefined}
        >
          <ColumnsIcon cols={cols} />
          <span>{cols}列</span>
        </button>
      </header>

      {/* Future: tabs (手札/行きたい) and the filter bar go here (construction 6). */}

      {import.meta.env.DEV && <DevSampleBar variant={variant} onVariant={changeVariant} onDataChanged={() => void reload()} />}

      {rows && columns && rows.length === 0 && <p className="empty">＋から最初のお店を登録</p>}

      <ul className="tile-grid" style={gridStyle} data-testid="tile-grid" data-cols={cols} aria-busy={rows === undefined || columns === undefined}>
        {(rows === undefined || columns === undefined) &&
          Array.from({ length: SKELETON_COUNT }, (_, i) => <li key={i} className="tile-skeleton" aria-hidden="true" />)}
        {columns !== undefined &&
          rows?.map(({ shop, cover }) => (
            <li key={shop.id} className="tile-cell">
              <ShopTile shop={shop} cover={cover} onOpen={onOpenShop} />
            </li>
          ))}
      </ul>

      <button type="button" className="fab" aria-label="お店を登録" onClick={onAdd}>
        ＋
      </button>
    </div>
  )
}

/** Small grid icon showing the current column count. */
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
