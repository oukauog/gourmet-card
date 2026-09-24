import { beforeEach, describe, expect, it } from 'vitest'
import { db } from './db'
import { RecordNotFoundError, PhotoLimitError, ValidationError } from './errors'
import { addPhoto, getPhoto, getPhotosForShop, removePhoto, reorderPhotos } from './photos'
import { createShop, getShop } from './shops'
import { blobOf, bytesOf, resetDbAndClock } from './testHelpers'

const input = (n: number) => ({ small: blobOf([n, 1]), large: blobOf([n, 2, 3]), width: 1600, height: 1200 })

describe('photos', () => {
  beforeEach(resetDbAndClock)

  it('appends to photoIds and stores blobs', async () => {
    const shop = await createShop({ name: 'a' })
    const p1 = await addPhoto(shop.id, input(1))
    const p2 = await addPhoto(shop.id, input(2))
    const after = await getShop(shop.id)
    expect(after?.photoIds).toEqual([p1.id, p2.id])
    expect(after!.updatedAt > shop.updatedAt).toBe(true)
    const back = await getPhoto(p2.id)
    expect(back?.shopId).toBe(shop.id)
    expect(await bytesOf(back!.small)).toEqual([2, 1])
    expect(await bytesOf(back!.large)).toEqual([2, 2, 3])
  })

  it('allows at most 3 photos per shop', async () => {
    const shop = await createShop({ name: 'a' })
    for (let i = 0; i < 3; i++) await addPhoto(shop.id, input(i))
    await expect(addPhoto(shop.id, input(9))).rejects.toBeInstanceOf(PhotoLimitError)
    expect((await getShop(shop.id))?.photoIds).toHaveLength(3)
    expect(await db.photos.count()).toBe(3)
  })

  it('rejects a missing shop and bad input', async () => {
    await expect(addPhoto('missing', input(1))).rejects.toBeInstanceOf(RecordNotFoundError)
    const shop = await createShop({ name: 'a' })
    await expect(addPhoto(shop.id, { ...input(1), width: 0 })).rejects.toBeInstanceOf(ValidationError)
    await expect(
      addPhoto(shop.id, { ...input(1), small: 'x' as unknown as Blob }),
    ).rejects.toBeInstanceOf(ValidationError)
    expect(await db.photos.count()).toBe(0)
  })

  it('removePhoto deletes the photo and removes it from photoIds', async () => {
    const shop = await createShop({ name: 'a' })
    const p1 = await addPhoto(shop.id, input(1))
    const p2 = await addPhoto(shop.id, input(2))
    expect(await removePhoto(p1.id)).toBe(true)
    expect(await getPhoto(p1.id)).toBeUndefined()
    expect((await getShop(shop.id))?.photoIds).toEqual([p2.id])
    expect(await removePhoto(p1.id)).toBe(false)
  })

  it('reorderPhotos changes the cover (first) photo', async () => {
    const shop = await createShop({ name: 'a' })
    const [p1, p2, p3] = [await addPhoto(shop.id, input(1)), await addPhoto(shop.id, input(2)), await addPhoto(shop.id, input(3))]
    await reorderPhotos(shop.id, [p3.id, p1.id, p2.id])
    expect((await getShop(shop.id))?.photoIds).toEqual([p3.id, p1.id, p2.id])
    const photos = await getPhotosForShop(shop.id)
    expect(photos.map((p) => p.id)).toEqual([p3.id, p1.id, p2.id])
    expect(photos[0].id).toBe(p3.id) // cover
  })

  it('reorderPhotos rejects anything but a reordering of the same set', async () => {
    const shop = await createShop({ name: 'a' })
    const p1 = await addPhoto(shop.id, input(1))
    const p2 = await addPhoto(shop.id, input(2))
    const bad = [[p1.id], [p1.id, p2.id, 'x'], [p1.id, p1.id], [p1.id, 'x'], []]
    for (const ids of bad) {
      await expect(reorderPhotos(shop.id, ids)).rejects.toBeInstanceOf(ValidationError)
    }
    expect((await getShop(shop.id))?.photoIds).toEqual([p1.id, p2.id])
    await expect(reorderPhotos('missing', [])).rejects.toBeInstanceOf(RecordNotFoundError)
  })

  it('getPhotosForShop returns [] for a missing shop', async () => {
    expect(await getPhotosForShop('missing')).toEqual([])
  })
})
