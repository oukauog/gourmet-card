// Rating input (spec 4.2.1): slider 1..50 + "-0.1" / "+0.1" buttons. Internal value is an
// integer 1..50 (3.7 -> 37) or undefined (not rated). Only these values can come out of here.

export const RATING_MIN = 1
export const RATING_MAX = 50
/** Where "-0.1" / "+0.1" / the slider start from when the shop is not rated yet (3.0). */
export const UNRATED_START = 30

/** Round to an integer and keep it in 1..50. Non-finite input gives UNRATED_START. */
export function clampRating(value: number): number {
  if (!Number.isFinite(value)) return UNRATED_START
  return Math.min(RATING_MAX, Math.max(RATING_MIN, Math.round(value)))
}

/** One "-0.1" (delta -1) or "+0.1" (delta +1) press. From "not rated" it starts at 3.0. */
export function stepRating(current: number | undefined, delta: number): number {
  return clampRating((current ?? UNRATED_START) + delta)
}

/** Value of the slider (a string from <input type="range">) -> 1..50. */
export function ratingFromSlider(value: string | number): number {
  return clampRating(typeof value === 'number' ? value : Number(value))
}
