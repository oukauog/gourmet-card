import { beforeEach, describe, expect, it } from 'vitest'
import { createShopWithPhotos } from '../db/createShopWithPhotos'
import { getPhotosForShop } from '../db/photos'
import { getShop, listShops } from '../db/shops'
import { findOrCreateTag, listTags } from '../db/tags'
import { seedUseTags } from '../db/seedUseTags'
import { blobOf, bytesOf, resetDbAndClock } from '../db/testHelpers'
import { addSampleShops, removeSampleShops, SAMPLE_LONG_MEMO, SAMPLE_SUFFIX, sampleFields } from './sampleData'

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

  it('about every 5th copy is a wishlist shop (construction 6)', async () => {
    await createShopWithPhotos({ name: '元' }, [])
    await addSampleShops(11) // i = 0..9
    const samples = (await listShops()).filter((s) => s.name.endsWith(SAMPLE_SUFFIX))
    expect(samples.filter((s) => s.status === 'wishlist')).toHaveLength(2) // i = 4, 9
    expect(samples.filter((s) => s.status === 'visited')).toHaveLength(8)
  })

  it('works with no shops at all', async () => {
    expect(await addSampleShops(3)).toBe(3)
    expect((await listShops()).every((s) => s.name.endsWith(SAMPLE_SUFFIX))).toBe(true)
  })

  it('fields are decided by i: full, partial and empty all appear', () => {
    expect(sampleFields(0)).toEqual(sampleFields(0)) // no randomness
    const full = sampleFields(0)
    expect(full.genres).toHaveLength(2)
    expect(full.uses).toEqual(['個室あり'])
    expect(full.areas).toEqual(['総曲輪', '八尾'])
    expect([full.prefecture, full.city]).toEqual(['富山県', '富山市'])
    expect(full.mapUrl).toMatch(/^https:\/\/www\.google\.com\/maps\/search\/\?api=1&query=/)
    expect(decodeURIComponent(full.mapUrl!.split('query=')[1])).toBe('富山市 総曲輪')
    expect(full.memo).toBe(SAMPLE_LONG_MEMO)
    expect(SAMPLE_LONG_MEMO.split('\n').length).toBeGreaterThanOrEqual(3)
    expect(SAMPLE_LONG_MEMO).toMatch(/[A-Za-z0-9]{40,}/)

    const empty = Array.from({ length: 30 }, (_, i) => sampleFields(i)).find(
      (f) => f.genres.length + f.uses.length + f.areas.length === 0 && !f.prefecture && !f.city && !f.mapUrl && !f.memo,
    )
    expect(empty).toBeDefined()
    const fields = Array.from({ length: 22 }, (_, i) => sampleFields(i))
    expect(fields.some((f) => f.genres.length === 1)).toBe(true)
    expect(fields.some((f) => f.memo && !f.memo.includes('\n'))).toBe(true)
    expect(fields.some((f) => f.prefecture === '石川県')).toBe(true)
  })

  it('attaches tags, place, map URL and memo to the copies', async () => {
    await createShopWithPhotos({ name: '元' }, [])
    await addSampleShops(4)
    const tags = new Map((await listTags()).map((t) => [t.id, t]))
    const first = (await listShops()).find((s) => s.name === `元${SAMPLE_SUFFIX}` && s.areaTagIds.length > 0)!
    const s = (await getShop(first.id))!
    const f = sampleFields(0)
    expect(s.genreTagIds.map((id) => tags.get(id)!.name)).toEqual(f.genres)
    expect(s.useTagIds.map((id) => tags.get(id)!.name)).toEqual(['個室あり'])
    expect(s.areaTagIds.map((id) => tags.get(id)!.name)).toEqual(['総曲輪', '八尾'])
    expect(tags.get(s.useTagIds[0])!.kind).toBe('use')
    expect(tags.get(s.areaTagIds[0])!.kind).toBe('area')
    expect([s.prefecture, s.city, s.mapUrl, s.memo]).toEqual([f.prefecture, f.city, f.mapUrl, f.memo])
  })

  it('removing the samples also removes the sample tags that no shop uses', async () => {
    await createShopWithPhotos({ name: '元' }, [])
    await addSampleShops()
    expect((await listTags()).length).toBeGreaterThan(0)

    await removeSampleShops()
    // construction 5: "個室あり" is an initial use tag, so it is kept (see the last test)
    expect((await listTags()).map((t) => `${t.kind}:${t.name}`)).toEqual(['use:個室あり'])
    expect((await listShops()).map((s) => s.name)).toEqual(['元'])
  })

  it('keeps a sample-named tag that one of your own shops uses (and keeps it attached)', async () => {
    const ramen = await findOrCreateTag('genre', 'ラーメン')
    const other = await findOrCreateTag('genre', 'そば') // not a sample tag, unused
    const own = await createShopWithPhotos({ name: '自分の店', genreTagIds: [ramen.id] }, [])
    await addSampleShops(8)

    await removeSampleShops()
    // (+ the initial use tag 個室あり, which is never deleted since construction 5)
    const kept = (await listTags()).filter((t) => t.kind !== 'use')
    expect(kept.map((t) => t.id).sort()).toEqual([ramen.id, other.id].sort())
    expect((await getShop(own.id))!.genreTagIds).toEqual([ramen.id])
  })

  it('never deletes the initial use tags (個室あり / 駐車場あり), even when no shop uses them', async () => {
    await seedUseTags()
    const before = (await listTags('use')).map((t) => t.id).sort()
    expect(before).toHaveLength(2)
    await createShopWithPhotos({ name: '元' }, [])
    await addSampleShops()
    await removeSampleShops()
    expect((await listTags('use')).map((t) => t.id).sort()).toEqual(before)
    expect((await listTags('use')).map((t) => t.name).sort()).toEqual(['個室あり', '駐車場あり'].sort())
    expect(await listTags('genre')).toEqual([])
    expect(await listTags('area')).toEqual([])
  })
})
