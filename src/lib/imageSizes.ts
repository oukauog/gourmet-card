// Photo output sizes (spec 3.3). Change here only.
// large: 1800px / 0.85 decided by Hanai-san on 2026-09-24 (middle of 1600-2000).
// small: 600px (was 400) decided on 2026-09-25: tiles are square-cropped, so the short side
// (450px for a 4:3 photo) must cover the tile width x3 on iPhone. Existing photos are not redone.

export interface ImageSizeSpec {
  /** Target long side in px. Smaller images are never enlarged. */
  longSide: number
  /** JPEG quality 0..1 for canvas.toBlob. */
  quality: number
}

/** For the list (tiles). */
export const SMALL_IMAGE: ImageSizeSpec = { longSide: 600, quality: 0.8 }

/** For the shop page. */
export const LARGE_IMAGE: ImageSizeSpec = { longSide: 1800, quality: 0.85 }

export const OUTPUT_IMAGE_TYPE = 'image/jpeg'
