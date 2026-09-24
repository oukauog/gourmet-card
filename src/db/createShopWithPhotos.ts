import { db } from './db'
import { addPhoto } from './photos'
import { createShop, getShop } from './shops'
import type { PhotoInput, Shop, ShopInput } from './types'

/**
 * Create a shop and add its photos (in the given order; the first is the cover) atomically.
 * If anything fails (blank name, 4th photo, bad photo input, ...) nothing is saved.
 *
 * Built only from the public API (createShop / addPhoto). Their own transactions join this
 * parent transaction; the parent must include every table they use (shops, photos, tags).
 */
export async function createShopWithPhotos(input: ShopInput, photos: readonly PhotoInput[]): Promise<Shop> {
  return db.transaction('rw', db.shops, db.photos, db.tags, async () => {
    const shop = await createShop(input)
    for (const photo of photos) await addPhoto(shop.id, photo)
    const saved = await getShop(shop.id)
    if (!saved) throw new Error('shop disappeared during save')
    return saved
  })
}
