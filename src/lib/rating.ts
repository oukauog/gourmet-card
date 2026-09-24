// Rating is stored as an integer 1..50 (3.7 -> 37) to avoid float errors (spec 3.2).
// Undefined means "not rated".

export const RATING_MIN = 1
export const RATING_MAX = 50
export const STAR_COUNT = 5

const UNRATED_TEXT = '未評価'

/** True only for integers 1..50. */
export function isValidRating(n: unknown): n is number {
  return typeof n === 'number' && Number.isInteger(n) && n >= RATING_MIN && n <= RATING_MAX
}

/** 37 -> "3.7", 50 -> "5.0", undefined -> "未評価". Throws RangeError for invalid values. */
export function ratingToText(rating: number | undefined): string {
  if (rating === undefined) return UNRATED_TEXT
  if (!isValidRating(rating)) throw new RangeError(`invalid rating: ${rating}`)
  return `${Math.floor(rating / 10)}.${rating % 10}`
}

/**
 * 3.7 -> 37. Absorbs float error (3.7 * 10 = 37.000000000000004 -> 37).
 * Throws RangeError if the value is outside 0.1..5.0 or not on the 0.1 grid (e.g. 3.75).
 */
export function ratingFromNumber(value: number): number {
  const scaled = value * 10
  const rounded = Math.round(scaled)
  if (!Number.isFinite(scaled) || Math.abs(scaled - rounded) > 1e-6 || !isValidRating(rounded)) {
    throw new RangeError(`invalid rating number: ${value}`)
  }
  return rounded
}

/**
 * Fill ratio (0..1) of each of the 5 stars (spec 4.4). 37 -> [1, 1, 1, 0.7, 0].
 * Unrated -> all 0; showing "未評価" instead is the screen's job.
 */
export function starFills(rating: number | undefined): number[] {
  if (rating === undefined) return Array<number>(STAR_COUNT).fill(0)
  if (!isValidRating(rating)) throw new RangeError(`invalid rating: ${rating}`)
  return Array.from({ length: STAR_COUNT }, (_, i) => Math.min(10, Math.max(0, rating - i * 10)) / 10)
}
