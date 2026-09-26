// Pure helpers for the shop page (construction 4). No DOM, no React.

/** True only for http: / https: URLs (surrounding spaces ignored). javascript:, data:, blank or broken -> false. */
export function isOpenableUrl(url: string | undefined): boolean {
  const s = url?.trim()
  if (!s) return false
  try {
    const { protocol } = new URL(s)
    return protocol === 'http:' || protocol === 'https:'
  } catch {
    return false
  }
}

/**
 * Index (0..count-1) of the slide nearest to the scroll position (rounded).
 * Never throws: zero / negative / non-finite width or count <= 0 give 0.
 */
export function slideIndexFromScroll(scrollLeft: number, slideWidth: number, count: number): number {
  if (!(count > 0) || !(slideWidth > 0) || !Number.isFinite(scrollLeft)) return 0
  const i = Math.round(scrollLeft / slideWidth)
  return Math.min(Math.max(i, 0), Math.floor(count) - 1)
}

/** "富山県 富山市" / "富山県" / "富山市" / "" (blank parts are skipped). */
export function formatPlace(prefecture: string | undefined, city: string | undefined): string {
  return [prefecture, city]
    .map((s) => s?.trim())
    .filter((s): s is string => !!s)
    .join(' ')
}
