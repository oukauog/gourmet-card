// Texts of "ホーム画面で使う" (construction 9, spec 4.6): the install guide sheet and the data screen.

export const INSTALL_STEPS = {
  ios: ['画面下の共有ボタン（□に↑）を押す', '「ホーム画面に追加」を選ぶ', 'ホーム画面のアイコンから開く'],
  android: ['右上のメニュー（︙）を押す', '「ホーム画面に追加」または「アプリをインストール」を選ぶ', 'ホーム画面のアイコンから開く'],
} as const

export const MOVE_SHOPS_NOTE = 'Safari 等で入れたお店はホーム画面のアプリには出ません。バックアップして、ホーム画面のアプリで取り込んでください'
export const REMOVE_ICON_NOTE = 'ホーム画面のアイコンを削除すると、そのアプリのお店も消えます。先にバックアップしてください'

/** Opened from the home screen (display-mode standalone, or iOS navigator.standalone). */
export function isStandalone(): boolean {
  try {
    if (window.matchMedia?.('(display-mode: standalone)').matches) return true
  } catch {
    // no matchMedia
  }
  return (navigator as Navigator & { standalone?: boolean }).standalone === true
}
