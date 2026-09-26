// Save the register / edit form (construction 5). Built only from the public API.
// Each save is ONE transaction over shops, photos and tags (every table the child API calls
// touch; a missing one gives SubTransactionError). If any step throws, nothing is changed.
import type { ShopFormData } from '../lib/shopForm'
import { createShopWithPhotos } from './createShopWithPhotos'
import { db } from './db'
import { RecordNotFoundError } from './errors'
import { addPhoto, removePhoto, reorderPhotos } from './photos'
import { getShop, updateShop } from './shops'
import { findOrCreateTag } from './tags'
import type { PhotoInput, Shop, TagKind } from './types'

/** One photo of the final order: a photo already saved, or a new one (already resized). */
export type PhotoSlot = { photoId: string } | { photo: PhotoInput }

/** Existing tags by id; new ones are created here, at save time (never while typing). */
async function resolveTags(kind: TagKind, tags: ShopFormData['genres']): Promise<string[]> {
  const ids: string[] = []
  for (const t of tags) ids.push(t.id ?? (await findOrCreateTag(kind, t.name)).id)
  return [...new Set(ids)]
}

async function tagFields(data: ShopFormData) {
  return {
    genreTagIds: await resolveTags('genre', data.genres),
    useTagIds: await resolveTags('use', data.uses),
    areaTagIds: await resolveTags('area', data.areas),
  }
}

/** New shop: shop + photos (in this order, the first is the cover) + new tags. */
export async function createShopFromForm(data: ShopFormData, photos: readonly PhotoInput[]): Promise<Shop> {
  return db.transaction('rw', db.shops, db.photos, db.tags, async () => {
    const { name, status, rating, prefecture, mapUrl, memo } = data
    return createShopWithPhotos({ name, status, rating, prefecture, mapUrl, memo, ...(await tagFields(data)) }, photos)
  })
}

/**
 * Edit: new tags -> fields -> removed photos -> added photos -> final order, all at once.
 * `city` is cleared only when the prefecture changed; `stationId` is never touched.
 */
export async function saveShopEdit(shopId: string, data: ShopFormData, photos: readonly PhotoSlot[]): Promise<Shop> {
  return db.transaction('rw', db.shops, db.photos, db.tags, async () => {
    const before = await getShop(shopId)
    if (!before) throw new RecordNotFoundError(`shop not found: ${shopId}`)

    const { name, status, rating, prefecture, mapUrl, memo } = data
    await updateShop(shopId, {
      name,
      status,
      rating,
      prefecture,
      mapUrl,
      memo,
      ...(await tagFields(data)),
      ...(prefecture !== before.prefecture ? { city: undefined } : {}),
    })

    const kept = new Set(photos.flatMap((s) => ('photoId' in s ? [s.photoId] : [])))
    for (const id of before.photoIds) if (!kept.has(id)) await removePhoto(id)
    const order: string[] = []
    for (const slot of photos) order.push('photoId' in slot ? slot.photoId : (await addPhoto(shopId, slot.photo)).id)
    await reorderPhotos(shopId, order)

    const saved = await getShop(shopId)
    if (!saved) throw new Error('shop disappeared during save')
    return saved
  })
}
