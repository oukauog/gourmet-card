// DEV ONLY (construction 3 look comparison; removed in construction 3a).
// Tile design variant, kept per tab in sessionStorage. The variants differ ONLY by CSS class.

export type TileVariant = 'a1' | 'a2'

const KEY = 'gourmet:tileVariant'

export function loadTileVariant(): TileVariant {
  try {
    return sessionStorage.getItem(KEY) === 'a2' ? 'a2' : 'a1'
  } catch {
    return 'a1'
  }
}

export function saveTileVariant(v: TileVariant): void {
  try {
    sessionStorage.setItem(KEY, v)
  } catch {
    // ignore (private mode etc.)
  }
}
