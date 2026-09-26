// Shop page (spec 4.3 / 4.3.1, construction 4).
// Order: photos, name, stars, ("行った！" for wishlist shops), tags, place, Google Maps, memo,
// edit, delete. Empty items are not shown at all (only "未評価" is shown for a missing rating).
// "この店を送る" comes with construction 8.
import { useEffect, useState } from 'react'
import { PhotoCarousel } from '../components/PhotoCarousel'
import { Stars } from '../components/Stars'
import { getPhotosForShop } from '../db/photos'
import { deleteShop, getShop, updateShop } from '../db/shops'
import { listTags } from '../db/tags'
import type { Shop, Tag } from '../db/types'
import { formatPlace, isOpenableUrl } from '../lib/shopView'
import '../styles/shop.css'

interface Props {
  shopId: string
  onBack: () => void
  onDeleted: () => void
  /** Open the edit screen (navigate). */
  onEdit: () => void
}

interface ShopView {
  shop: Shop
  /** LARGE images in shop.photoIds order. */
  photos: Blob[]
  genres: Tag[]
  uses: Tag[]
  areas: Tag[]
}

type Loaded = { state: 'loading' } | { state: 'missing' } | ({ state: 'ok' } & ShopView)

async function loadShopView(shopId: string): Promise<ShopView | undefined> {
  const shop = await getShop(shopId)
  if (!shop) return undefined
  const [photoList, tags] = await Promise.all([getPhotosForShop(shop.id), listTags()])
  const photoById = new Map(photoList.map((p) => [p.id, p]))
  const tagById = new Map(tags.map((t) => [t.id, t]))
  // unknown ids are skipped silently
  const pick = (ids: string[]) => ids.map((id) => tagById.get(id)).filter((t): t is Tag => t !== undefined)
  return {
    shop,
    photos: shop.photoIds.map((id) => photoById.get(id)?.large).filter((b): b is Blob => b !== undefined),
    genres: pick(shop.genreTagIds),
    uses: pick(shop.useTagIds),
    areas: pick(shop.areaTagIds),
  }
}

export function ShopScreen({ shopId, onBack, onDeleted, onEdit }: Props) {
  const [data, setData] = useState<Loaded>({ state: 'loading' })

  useEffect(() => {
    let active = true
    window.scrollTo(0, 0)
    ;(async () => {
      const view = await loadShopView(shopId)
      if (!active) return
      setData(view ? { state: 'ok', ...view } : { state: 'missing' })
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

  // "行った！": becomes 手札 right away, then the edit screen asks for photos / rating
  const went = async (shop: Shop) => {
    await updateShop(shop.id, { status: 'visited' })
    onEdit()
  }

  // nothing while loading (no flicker)
  if (data.state === 'loading') return <div className="screen shop-screen" />

  return (
    <div className="screen shop-screen">
      {/* photo from the very top of the screen; round back button floats top-left (4.3.1) */}
      <button type="button" className="shop-float-back" aria-label="戻る" onClick={onBack}>
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M15 5l-7 7 7 7" />
        </svg>
      </button>

      {data.state === 'missing' && (
        <div className="shop-missing">
          <p>この店は見つかりません</p>
          <button type="button" className="btn btn-secondary" onClick={onBack}>
            一覧へ戻る
          </button>
        </div>
      )}

      {data.state === 'ok' && <ShopBody view={data} onWent={() => void went(data.shop)} />}

      {data.state === 'ok' && (
        <button type="button" className="btn btn-secondary shop-edit" onClick={onEdit}>
          編集
        </button>
      )}

      {data.state === 'ok' && (
        <button type="button" className="btn btn-danger-text shop-delete" onClick={() => void remove(data.shop)}>
          この店を削除
        </button>
      )}
    </div>
  )
}

function ShopBody({ view, onWent }: { view: ShopView; onWent: () => void }) {
  const { shop, photos, genres, uses, areas } = view
  const place = formatPlace(shop.prefecture, shop.city)
  const areaText = areas.map((t) => t.name).join('・')
  const mapUrl = isOpenableUrl(shop.mapUrl) ? shop.mapUrl!.trim() : undefined
  const memo = shop.memo?.trim() ? shop.memo : undefined

  return (
    <>
      <div className="shop-photos">
        <PhotoCarousel photos={photos} name={shop.name} />
      </div>

      <h1 className="shop-name">{shop.name}</h1>
      <div className="shop-rating">
        {shop.rating !== undefined ? <Stars rating={shop.rating} size={22} /> : <span className="shop-unrated">未評価</span>}
      </div>

      {shop.status === 'wishlist' && (
        <button type="button" className="btn btn-primary btn-block shop-went" onClick={onWent}>
          行った！
        </button>
      )}

      {(genres.length > 0 || uses.length > 0) && (
        <ul className="shop-tags" aria-label="タグ">
          {genres.map((t) => (
            <li key={t.id} className="shop-tag shop-tag-genre">
              {t.name}
            </li>
          ))}
          {uses.map((t) => (
            <li key={t.id} className="shop-tag shop-tag-use">
              {t.name}
            </li>
          ))}
        </ul>
      )}

      {(place || areaText) && (
        <section className="shop-section" aria-label="場所">
          <h2 className="shop-section-title">場所</h2>
          <p className="shop-place">
            {place && <span>{place}</span>}
            {areaText && <span className="shop-area">{areaText}</span>}
          </p>
        </section>
      )}

      {mapUrl && (
        <a className="btn btn-secondary shop-map" href={mapUrl} target="_blank" rel="noopener noreferrer">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M12 2.5a7 7 0 0 0-7 7c0 5.2 7 12 7 12s7-6.8 7-12a7 7 0 0 0-7-7zm0 9.6a2.6 2.6 0 1 1 0-5.2 2.6 2.6 0 0 1 0 5.2z" />
          </svg>
          Googleマップで開く
        </a>
      )}

      {memo && (
        <section className="shop-section" aria-label="メモ">
          <h2 className="shop-section-title">メモ</h2>
          <p className="shop-memo">{memo}</p>
        </section>
      )}
    </>
  )
}
