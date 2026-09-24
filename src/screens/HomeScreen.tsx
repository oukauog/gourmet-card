// TEMPORARY home screen (construction 2). Replaced by the real tile list in construction 3.
import { useCallback, useEffect, useState } from 'react'
import { BlobImage } from '../components/BlobImage'
import { getPhoto } from '../db/photos'
import { deleteShop, listShops } from '../db/shops'
import type { Shop } from '../db/types'

interface Props {
  onAdd: () => void
}

interface Row {
  shop: Shop
  cover?: Blob
}

function formatLocal(iso: string): string {
  const d = new Date(iso)
  const p = (n: number) => String(n).padStart(2, '0')
  return `${p(d.getMonth() + 1)}/${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`
}

async function loadRows(): Promise<Row[]> {
  const shops = await listShops()
  return Promise.all(
    shops.map(async (shop) => {
      // Only the cover's small image is shown; getPhoto of the first id = first of getPhotosForShop.
      const cover = shop.photoIds[0] ? (await getPhoto(shop.photoIds[0]))?.small : undefined
      return { shop, cover }
    }),
  )
}

export function HomeScreen({ onAdd }: Props) {
  const [rows, setRows] = useState<Row[]>()

  const reload = useCallback(async () => {
    setRows(await loadRows())
  }, [])

  useEffect(() => {
    let active = true
    loadRows().then((r) => active && setRows(r))
    return () => {
      active = false
    }
  }, [])

  const remove = async (shop: Shop) => {
    if (!window.confirm(`「${shop.name}」を削除しますか？`)) return
    await deleteShop(shop.id)
    await reload()
  }

  return (
    <div className="screen home-screen">
      <header className="topbar">
        <h1 className="topbar-title home-title">グルメカード</h1>
      </header>

      {rows && rows.length === 0 && <p className="empty">＋から最初のお店を登録</p>}

      {rows && rows.length > 0 && (
        <ul className="shop-rows">
          {rows.map(({ shop, cover }) => (
            <li key={shop.id} className="shop-row">
              {cover ? (
                <BlobImage blob={cover} alt="" className="shop-row-thumb" />
              ) : (
                <div className="shop-row-thumb shop-row-thumb-empty" />
              )}
              <div className="shop-row-body">
                <div className="shop-row-name">{shop.name}</div>
                <div className="shop-row-meta">
                  <span>写真 {shop.photoIds.length}枚</span>
                  <span>{formatLocal(shop.createdAt)}</span>
                </div>
              </div>
              <button type="button" className="btn btn-danger-text" onClick={() => void remove(shop)}>
                削除
              </button>
            </li>
          ))}
        </ul>
      )}

      <button type="button" className="fab" aria-label="お店を登録" onClick={onAdd}>
        ＋
      </button>
    </div>
  )
}
