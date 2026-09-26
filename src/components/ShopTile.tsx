import type { Shop } from '../db/types'
import { BlobImage } from './BlobImage'
import { Stars } from './Stars'
import { tileToneIndex } from './tileTone'
import '../styles/tones.css'

interface Props {
  shop: Shop
  /** Cover photo, SMALL size only (never load `large` in the list). */
  cover?: Blob
  onOpen: (shopId: string) => void
}

/** Square tile: cover photo with the name (and stars if rated) over a bottom gradient. */
export function ShopTile({ shop, cover, onOpen }: Props) {
  const rated = shop.rating !== undefined
  return (
    <button
      type="button"
      className={cover ? 'tile tile-photo' : 'tile tile-nophoto'}
      data-tone={cover ? undefined : tileToneIndex(shop.name)}
      aria-label={shop.name}
      onClick={() => onOpen(shop.id)}
    >
      {cover && <BlobImage blob={cover} alt="" className="tile-img" loading="lazy" decoding="async" />}
      <span className="tile-caption">
        <span className="tile-name">{shop.name}</span>
        {rated && <Stars rating={shop.rating!} />}
      </span>
    </button>
  )
}
