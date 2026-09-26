// DEV ONLY (construction 4 look comparison; removed in construction 4a).
// Remembers the chosen shop page look in sessionStorage so every shop opens with it.
// Imported only behind `import.meta.env.DEV` (ShopScreen), so it is not in the production build.
import { DEFAULT_SHOP_LOOK, type ShopLook } from '../screens/shopLookTypes'

const KEY = 'gc-dev-shop-look'

export function loadShopLook(): ShopLook {
  try {
    const v = JSON.parse(sessionStorage.getItem(KEY) ?? 'null') as Partial<ShopLook> | null
    return {
      ratio: v?.ratio === '4x5' ? '4x5' : DEFAULT_SHOP_LOOK.ratio,
      head: v?.head === 'overlay' ? 'overlay' : DEFAULT_SHOP_LOOK.head,
    }
  } catch {
    return DEFAULT_SHOP_LOOK
  }
}

export function saveShopLook(look: ShopLook): void {
  try {
    sessionStorage.setItem(KEY, JSON.stringify(look))
  } catch {
    // private mode etc.: the choice just is not remembered
  }
}
