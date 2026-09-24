import { beforeEach, describe, expect, it } from 'vitest'
import { createShopWithPhotos } from '../db/createShopWithPhotos'
import { getPhotosForShop } from '../db/photos'
import { listShops } from '../db/shops'
import { blobOf, bytesOf, resetDbAndClock } from '../db/testHelpers'
import { addSampleShops, removeSampleShops, SAMPLE_SUFFIX } from './sampleData'

describe('sample data (dev only)', () => {
  beforeEach(resetDbAndClock)

  it('grows to 24 shops with copied photos and ratings, then removes only the samples', async () => {
    await createShopWithPhotos({ name: '元A' }, [])
    const b = await createShopWithPhotos({ name: '元B' }, [{ small: blobOf([7]), large: blobOf([8]), width: 10, height: 10 }])

    expect(await addSampleShops()).toBe(22)
    const all = await listShops()
    expect(all).toHaveLength(24)
    const samples = all.filter((s) => s.name.endsWith(SAMPLE_SUFFIX))
    expect(samples).toHaveLength(22)
    expect(samples.some((s) => s.rating !== undefined)).toBe(true)
    expect(samples.some((s) => s.rating === undefined)).toBe(true)
    expect(samples.some((s) => s.photoIds.length === 0)).toBe(true)

    const copyOfB = samples.find((s) => s.name === `元B${SAMPLE_SUFFIX}` && s.photoIds.length > 0)!
    const [photo] = await getPhotosForShop(copyOfB.id)
    expect(await bytesOf(photo.small)).toEqual([7])
    expect(photo.id).not.toBe(b.photoIds[0])

    expect(await addSampleShops()).toBe(0) // already 24

    expect(await removeSampleShops()).toBe(22)
    expect((await listShops()).map((s) => s.name).sort()).toEqual(['元A', '元B'])
  })

  it('works with no shops at all', async () => {
    expect(await addSampleShops(3)).toBe(3)
    expect((await listShops()).every((s) => s.name.endsWith(SAMPLE_SUFFIX))).toBe(true)
  })
})
