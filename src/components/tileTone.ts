/** Number of pale background tones for tiles without a photo (defined in app.css as data-tone). */
export const TILE_TONE_COUNT = 6

/** Tone index 0..5 decided by the shop name (sum of UTF-16 code units), stable across reloads. */
export function tileToneIndex(name: string): number {
  let sum = 0
  for (let i = 0; i < name.length; i++) sum += name.charCodeAt(i)
  return sum % TILE_TONE_COUNT
}
