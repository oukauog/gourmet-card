// Shop page look (construction 4). The look only changes classes on the page's top element:
// shop-ratio-1x1 / shop-ratio-4x5 and shop-head-bar / shop-head-overlay (shop.css).
// Until the look is chosen on a real phone (construction 4a), production uses the default.

export interface ShopLook {
  /** Photo width:height. */
  ratio: '1x1' | '4x5'
  /** bar = "← 戻る" bar above the photo; overlay = photo from the very top, floating back button. */
  head: 'bar' | 'overlay'
}

export const DEFAULT_SHOP_LOOK: ShopLook = { ratio: '1x1', head: 'bar' }
