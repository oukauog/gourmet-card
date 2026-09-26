// DEV ONLY: chips to switch the shop page look (2 x 2) for the comparison on a real phone.
// Lazily imported behind `import.meta.env.DEV` (ShopScreen), so it is not in the production build.
import type { ShopLook } from '../screens/shopLookTypes'
import { saveShopLook } from './shopLook'
import './devBar.css'
import './devShopLook.css'

interface Props {
  look: ShopLook
  onChange: (look: ShopLook) => void
}

const RATIOS: { value: ShopLook['ratio']; label: string }[] = [
  { value: '1x1', label: '1:1' },
  { value: '4x5', label: '4:5' },
]
const HEADS: { value: ShopLook['head']; label: string }[] = [
  { value: 'bar', label: 'バー' },
  { value: 'overlay', label: '重ね' },
]

export function DevShopLookChips({ look, onChange }: Props) {
  const set = (next: ShopLook) => {
    saveShopLook(next)
    onChange(next)
  }

  return (
    <div className="dev-bar dev-look" data-testid="dev-shop-look">
      <span className="dev-bar-label">写真</span>
      {RATIOS.map((r) => (
        <button
          key={r.value}
          type="button"
          className="dev-chip"
          aria-pressed={look.ratio === r.value}
          onClick={() => set({ ...look, ratio: r.value })}
        >
          {r.label}
        </button>
      ))}
      <span className="dev-bar-label">上部</span>
      {HEADS.map((h) => (
        <button
          key={h.value}
          type="button"
          className="dev-chip"
          aria-pressed={look.head === h.value}
          onClick={() => set({ ...look, head: h.value })}
        >
          {h.label}
        </button>
      ))}
    </div>
  )
}
