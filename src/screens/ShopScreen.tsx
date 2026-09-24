// TEMPORARY shop page (construction 3). Replaced by the real shop page in construction 4.
import { useEffect, useState } from 'react'
import { BlobImage } from '../components/BlobImage'
import { Stars } from '../components/Stars'
import { getPhoto } from '../db/photos'
import { deleteShop, getShop } from '../db/shops'
import type { Shop } from '../db/types'
import '../styles/shop.css'

interface Props {
  shopId: string
  onBack: () => void
  onDeleted: () => void
}

type Loaded = { state: 'loading' } | { state: 'missing' } | { state: 'ok'; shop: Shop; cover?: Blob }

export function ShopScreen({ shopId, onBack, onDeleted }: Props) {
  const [data, setData] = useState<Loaded>({ state: 'loading' })

  useEffect(() => {
    let active = true
    window.scrollTo(0, 0)
    ;(async () => {
      const shop = await getShop(shopId)
      if (!shop) return active && setData({ state: 'missing' })
      // The shop page shows the LARGE image (the list only uses small).
      const cover = shop.photoIds[0] ? (await getPhoto(shop.photoIds[0]))?.large : undefined
      if (active) setData({ state: 'ok', shop, cover })
    })()
    return () => {
      active = false
    }
  }, [shopId])

  const remove = async (shop: Shop) => {
    if (!window.confirm(`「${shop.name}」を削除しますか？`)) return
    await deleteShop(shop.id)
    onDeleted()
  }

  return (
    <div className="screen shop-screen">
      <header className="topbar">
        <button type="button" className="btn btn-text" onClick={onBack}>
          ← 戻る
        </button>
        <span className="topbar-title" />
        <span className="topbar-spacer" />
      </header>

      {data.state === 'missing' && (
        <div className="shop-missing">
          <p>この店は見つかりません</p>
          <button type="button" className="btn btn-secondary" onClick={onBack}>
            一覧へ戻る
          </button>
        </div>
      )}

      {data.state === 'ok' && (
        <>
          {data.cover && <BlobImage blob={data.cover} alt={data.shop.name} className="shop-cover" />}
          <h1 className="shop-name">{data.shop.name}</h1>
          <div className="shop-rating">
            {data.shop.rating !== undefined ? <Stars rating={data.shop.rating} size={20} /> : <span>未評価</span>}
          </div>
          <p className="shop-meta">写真 {data.shop.photoIds.length}枚</p>
          <button type="button" className="btn btn-danger-text shop-delete" onClick={() => void remove(data.shop)}>
            この店を削除
          </button>
        </>
      )}
    </div>
  )
}
