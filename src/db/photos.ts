import { newId } from '../lib/id'
import { nowIso } from '../lib/time'
import { db } from './db'
import { RecordNotFoundError, PhotoLimitError, ValidationError } from './errors'
import { MAX_PHOTOS_PER_SHOP, type Photo, type PhotoInput } from './types'

function checkPhotoInput(input: PhotoInput): void {
  if (!(input?.small instanceof Blob) || !(input?.large instanceof Blob)) {
    throw new ValidationError('small and large must be Blobs')
  }
  for (const key of ['width', 'height'] as const) {
    const v = input[key]
    if (!Number.isInteger(v) || v <= 0) throw new ValidationError(`${key} must be a positive integer`)
  }
}

/**
 * Save a photo (already resized) and append it to the end of shop.photoIds, in one transaction.
 * Throws RecordNotFoundError if the shop does not exist, PhotoLimitError if it already has 3 photos.
 */
export async function addPhoto(shopId: string, input: PhotoInput): Promise<Photo> {
  checkPhotoInput(input)
  return db.transaction('rw', db.shops, db.photos, async () => {
    const shop = await db.shops.get(shopId)
    if (!shop) throw new RecordNotFoundError(`shop not found: ${shopId}`)
    if (shop.photoIds.length >= MAX_PHOTOS_PER_SHOP) {
      throw new PhotoLimitError(`a shop can have at most ${MAX_PHOTOS_PER_SHOP} photos`)
    }
    const now = nowIso()
    const photo: Photo = {
      id: newId(),
      shopId,
      small: input.small,
      large: input.large,
      width: input.width,
      height: input.height,
      createdAt: now,
    }
    await db.photos.add(photo)
    shop.photoIds = [...shop.photoIds, photo.id]
    shop.updatedAt = now
    await db.shops.put(shop)
    return photo
  })
}

/** Delete a photo and remove it from its shop's photoIds. Returns false if it did not exist. */
export async function removePhoto(photoId: string): Promise<boolean> {
  return db.transaction('rw', db.shops, db.photos, async () => {
    const photo = await db.photos.get(photoId)
    if (!photo) return false
    await db.photos.delete(photoId)
    const shop = await db.shops.get(photo.shopId)
    if (shop && shop.photoIds.includes(photoId)) {
      shop.photoIds = shop.photoIds.filter((id) => id !== photoId)
      shop.updatedAt = nowIso()
      await db.shops.put(shop)
    }
    return true
  })
}

/**
 * Reorder a shop's photos. `orderedIds` must be exactly the same set as the current photoIds
 * (ValidationError otherwise). The first one becomes the cover.
 */
export async function reorderPhotos(shopId: string, orderedIds: string[]): Promise<void> {
  await db.transaction('rw', db.shops, async () => {
    const shop = await db.shops.get(shopId)
    if (!shop) throw new RecordNotFoundError(`shop not found: ${shopId}`)
    const current = new Set(shop.photoIds)
    const sameSet =
      Array.isArray(orderedIds) &&
      orderedIds.length === shop.photoIds.length &&
      new Set(orderedIds).size === orderedIds.length &&
      orderedIds.every((id) => current.has(id))
    if (!sameSet) throw new ValidationError('orderedIds must be a reordering of the current photoIds')
    shop.photoIds = [...orderedIds]
    shop.updatedAt = nowIso()
    await db.shops.put(shop)
  })
}

export async function getPhoto(id: string): Promise<Photo | undefined> {
  return db.photos.get(id)
}

/** Photos of a shop in photoIds order (cover first). Empty if the shop does not exist. */
export async function getPhotosForShop(shopId: string): Promise<Photo[]> {
  return db.transaction('r', db.shops, db.photos, async () => {
    const shop = await db.shops.get(shopId)
    if (!shop) return []
    const photos = await db.photos.bulkGet(shop.photoIds)
    return photos.filter((p): p is Photo => p !== undefined)
  })
}
