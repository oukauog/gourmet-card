import { beforeEach, describe, expect, it } from 'vitest'
import { createShopWithPhotos } from './createShopWithPhotos'
import { db } from './db'
import { PhotoLimitError, ValidationError } from './errors'
import { getPhotosForShop } from './photos'
import { listShops } from './shops'
import { blobOf, bytesOf, resetDbAndClock } from './testHelpers'

const photo = (n: number, width = 1800) => ({ small: blobOf([n]), large: blobOf([n, n]), width, height: 1200 })

describe('createShopWithPhotos', () => {
  beforeEach(resetDbAndClock)

  it('saves the shop and photos in order (first = cover)', async () => {
    const shop = await createShopWithPhotos({ name: ' 麺屋 ' }, [photo(1), photo(2)])
    expect(shop.name).toBe('麺屋')
    expect(shop.status).toBe('visited')
    expect(shop.photoIds).toHaveLength(2)
    const photos = await getPhotosForShop(shop.id)
    expect(photos.map((p) => p.id)).toEqual(shop.photoIds)
    expect(await bytesOf(photos[0].small)).toEqual([1])
    expect(await bytesOf(photos[1].large)).toEqual([2, 2])
  })

  it('saves a shop without photos', async () => {
    const shop = await createShopWithPhotos({ name: 'a' }, [])
    expect(shop.photoIds).toEqual([])
    expect(await listShops()).toHaveLength(1)
  })

  it('rolls back the shop when a photo fails (4 photos)', async () => {
    await expect(createShopWithPhotos({ name: 'a' }, [photo(1), photo(2), photo(3), photo(4)])).rejects.toBeInstanceOf(
      PhotoLimitError,
    )
    expect(await db.shops.count()).toBe(0)
    expect(await db.photos.count()).toBe(0)
  })

  it('rolls back the shop when photo input is invalid', async () => {
    await expect(createShopWithPhotos({ name: 'a' }, [photo(1), photo(2, 0)])).rejects.toBeInstanceOf(ValidationError)
    expect(await db.shops.count()).toBe(0)
    expect(await db.photos.count()).toBe(0)
  })

  it('saves nothing for a blank name', async () => {
    await expect(createShopWithPhotos({ name: '  ' }, [photo(1)])).rejects.toBeInstanceOf(ValidationError)
    expect(await db.shops.count()).toBe(0)
    expect(await db.photos.count()).toBe(0)
  })
})
