export interface Size {
  width: number
  height: number
}

/**
 * Scale (width, height) so that the long side becomes `longSide`, keeping the aspect ratio.
 * The short side is rounded and at least 1px. Images already within `longSide` are returned
 * unchanged (never enlarged). Throws RangeError for non-positive / non-integer input.
 */
export function fitLongSide(width: number, height: number, longSide: number): Size {
  for (const [name, v] of [['width', width], ['height', height], ['longSide', longSide]] as const) {
    if (!Number.isInteger(v) || v <= 0) throw new RangeError(`${name} must be a positive integer: ${v}`)
  }
  const long = Math.max(width, height)
  if (long <= longSide) return { width, height }
  const scale = longSide / long
  return width >= height
    ? { width: longSide, height: Math.max(1, Math.round(height * scale)) }
    : { width: Math.max(1, Math.round(width * scale)), height: longSide }
}
