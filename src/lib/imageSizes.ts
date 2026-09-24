// Photo output sizes (spec 3.3). Change here only.
// large: 1800px / 0.85 decided by Hanai-san on 2026-09-24 (middle of 1600-2000).

export interface ImageSizeSpec {
  /** Target long side in px. Smaller images are never enlarged. */
  longSide: number
  /** JPEG quality 0..1 for canvas.toBlob. */
  quality: number
}

/** For the list (tiles). */
export const SMALL_IMAGE: ImageSizeSpec = { longSide: 400, quality: 0.8 }

/** For the shop page. */
export const LARGE_IMAGE: ImageSizeSpec = { longSide: 1800, quality: 0.85 }

export const OUTPUT_IMAGE_TYPE = 'image/jpeg'
