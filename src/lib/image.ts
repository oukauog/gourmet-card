// Browser-only photo processing (canvas). Not unit-testable in Node; covered by e2e and real devices.
//
// Orientation: current browsers apply the EXIF orientation when decoding into <img>
// (CSS image-orientation: from-image is the default), and naturalWidth / naturalHeight are the
// rotated size. So we only draw the decoded image into a canvas. We do NOT read EXIF ourselves,
// to avoid rotating twice.

import { fitLongSide, type Size } from './imageSize'
import { LARGE_IMAGE, OUTPUT_IMAGE_TYPE, SMALL_IMAGE, type ImageSizeSpec } from './imageSizes'

export interface ProcessedImage {
  small: Blob
  large: Blob
  /** Size of the large image. */
  width: number
  height: number
}

/** Photo could not be processed. `userMessage` is Japanese text for the screen. */
export class ImageProcessError extends Error {
  readonly userMessage: string
  constructor(message: string, userMessage = 'この写真は読み込めませんでした') {
    super(message)
    this.name = 'ImageProcessError'
    this.userMessage = userMessage
  }
}

type Drawable = HTMLImageElement | ImageBitmap

interface Decoded {
  source: Drawable
  size: Size
  release: () => void
}

/** Main path: <img> + object URL. */
async function decodeWithImg(file: Blob): Promise<Decoded> {
  const url = URL.createObjectURL(file)
  const img = new Image()
  try {
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve()
      img.onerror = () => reject(new Error('img decode failed'))
      img.src = url
    })
  } catch (e) {
    URL.revokeObjectURL(url)
    throw e
  }
  if (!img.naturalWidth || !img.naturalHeight) {
    URL.revokeObjectURL(url)
    throw new Error('decoded image has no size')
  }
  return {
    source: img,
    size: { width: img.naturalWidth, height: img.naturalHeight },
    release: () => {
      URL.revokeObjectURL(url)
      img.src = ''
    },
  }
}

/** Fallback only: createImageBitmap (orientation applied explicitly). */
async function decodeWithBitmap(file: Blob): Promise<Decoded> {
  if (typeof createImageBitmap !== 'function') throw new Error('createImageBitmap not available')
  const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' })
  return {
    source: bitmap,
    size: { width: bitmap.width, height: bitmap.height },
    release: () => bitmap.close(),
  }
}

async function decode(file: Blob): Promise<Decoded> {
  try {
    return await decodeWithImg(file)
  } catch (imgError) {
    try {
      return await decodeWithBitmap(file)
    } catch {
      throw new ImageProcessError(`decode failed: ${String(imgError)}`)
    }
  }
}

/** Draw into a canvas of the target size (never the original size) and encode as JPEG. */
async function render(source: Drawable, original: Size, spec: ImageSizeSpec): Promise<{ blob: Blob; size: Size }> {
  const size = fitLongSide(original.width, original.height, spec.longSide)
  const canvas = document.createElement('canvas')
  canvas.width = size.width
  canvas.height = size.height
  try {
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new ImageProcessError('canvas 2d context not available')
    // White background so transparent PNG areas do not turn black in JPEG.
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, size.width, size.height)
    ctx.imageSmoothingEnabled = true
    ctx.imageSmoothingQuality = 'high'
    ctx.drawImage(source, 0, 0, size.width, size.height)
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, OUTPUT_IMAGE_TYPE, spec.quality))
    if (!blob) throw new ImageProcessError('canvas.toBlob returned null')
    return { blob, size }
  } finally {
    // Free the canvas memory right away (iOS Safari keeps it otherwise).
    canvas.width = 0
    canvas.height = 0
  }
}

/**
 * Decode a picked photo and make the two JPEG sizes (both directly from the original).
 * The result can be passed to addPhoto() as is. Rejects with ImageProcessError.
 */
export async function processImageFile(file: File | Blob): Promise<ProcessedImage> {
  const decoded = await decode(file)
  try {
    const large = await render(decoded.source, decoded.size, LARGE_IMAGE)
    const small = await render(decoded.source, decoded.size, SMALL_IMAGE)
    return { small: small.blob, large: large.blob, width: large.size.width, height: large.size.height }
  } catch (e) {
    if (e instanceof ImageProcessError) throw e
    throw new ImageProcessError(`render failed: ${String(e)}`)
  } finally {
    decoded.release()
  }
}
