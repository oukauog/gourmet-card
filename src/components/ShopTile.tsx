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
  /** Selection mode (construction 8b): a tap selects / unselects instead of opening the shop. */
  selection?: { selected: boolean; onToggle: (shopId: string) => void }
}

/** Square tile: cover photo with the name (and stars if rated) over a bottom gradient. */
export function ShopTile({ shop, cover, onOpen, selection }: Props) {
  const rated = shop.rating !== undefined
  const base = cover ? 'tile tile-photo' : 'tile tile-nophoto'
  return (
    <button
      type="button"
      className={selection ? `${base} tile-selectable` : base}
      data-tone={cover ? undefined : tileToneIndex(shop.name)}
      aria-label={shop.name}
      aria-pressed={selection ? selection.selected : undefined}
      onClick={() => (selection ? selection.onToggle(shop.id) : onOpen(shop.id))}
    >
      {cover && <BlobImage blob={cover} alt="" className="tile-img" loading="lazy" decoding="async" />}
      {selection && (
        <span className="tile-check" aria-hidden="true">
          <svg viewBox="0 0 24 24">
            <path d="M6 12.5l4 4 8-9" />
          </svg>
        </span>
      )}
      <span className="tile-caption">
        <span className="tile-name">{shop.name}</span>
        {rated && <Stars rating={shop.rating!} />}
      </span>
    </button>
  )
}
