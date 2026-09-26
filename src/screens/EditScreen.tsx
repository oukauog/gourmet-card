// Edit screen (#/shop/<id>/edit, construction 5). The same form as the register screen,
// filled with the shop's current values. Nothing changes in the DB until "保存".
import { useEffect, useState } from 'react'
import { ShopForm } from '../components/form/ShopForm'
import { getPhotosForShop } from '../db/photos'
import { saveShopEdit } from '../db/saveShopForm'
import { getShop } from '../db/shops'
import { listTags } from '../db/tags'
import type { SavedPhoto } from '../hooks/usePhotoDrafts'
import { shopFormFromShop, shopFormToData, type ShopFormValues } from '../lib/shopForm'
import '../styles/shop.css'

interface Props {
  shopId: string
  /** Leave the edit screen for the shop page (saved = true after a successful save). */
  onDone: (saved: boolean) => void
  onBackToList: () => void
}

type Loaded = { state: 'loading' } | { state: 'missing' } | { state: 'ok'; values: ShopFormValues; photos: SavedPhoto[] }

export function EditScreen({ shopId, onDone, onBackToList }: Props) {
  const [data, setData] = useState<Loaded>({ state: 'loading' })

  useEffect(() => {
    let active = true
    window.scrollTo(0, 0)
    ;(async () => {
      const shop = await getShop(shopId)
      if (!shop) return active && setData({ state: 'missing' })
      const [photos, tags] = await Promise.all([getPhotosForShop(shop.id), listTags()])
      const byId = new Map(photos.map((p) => [p.id, p]))
      const saved = shop.photoIds.flatMap((id) => {
        const p = byId.get(id)
        return p ? [{ id: p.id, small: p.small }] : []
      })
      if (active) setData({ state: 'ok', values: shopFormFromShop(shop, new Map(tags.map((t) => [t.id, t]))), photos: saved })
    })()
    return () => {
      active = false
    }
  }, [shopId])

  if (data.state === 'loading') return <div className="screen" />

  if (data.state === 'missing') {
    return (
      <div className="screen">
        <div className="shop-missing">
          <p>この店は見つかりません</p>
          <button type="button" className="btn btn-secondary" onClick={onBackToList}>
            一覧へ戻る
          </button>
        </div>
      </div>
    )
  }

  return (
    <ShopForm
      title="店を編集"
      initialValues={data.values}
      initialPhotos={data.photos}
      confirmDiscard
      onCancel={() => onDone(false)}
      onSubmit={async (values, photos) => {
        await saveShopEdit(shopId, shopFormToData(values), photos)
        onDone(true)
      }}
    />
  )
}
