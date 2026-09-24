import { beforeEach, describe, expect, it } from 'vitest'
import { db } from './db'
import { RecordNotFoundError, ValidationError } from './errors'
import { addPhoto } from './photos'
import { countShops, createShop, deleteShop, getShop, listShops, updateShop } from './shops'
import { findOrCreateTag } from './tags'
import { blobOf, resetDbAndClock } from './testHelpers'
import type { ShopPatch } from './types'

const photoInput = () => ({ small: blobOf([1]), large: blobOf([2]), width: 1600, height: 1200 })

describe('createShop', () => {
  beforeEach(resetDbAndClock)

  it.each(['', '   ', '　\t'])('requires a non-blank name (%j)', async (name) => {
    await expect(createShop({ name })).rejects.toBeInstanceOf(ValidationError)
    expect(await countShops()).toBe(0)
  })

  it('creates with name only and applies defaults', async () => {
    const shop = await createShop({ name: '  すし 富山  ' })
    expect(shop).toEqual({
      id: expect.stringMatching(/^[0-9a-f-]{36}$/),
      name: 'すし 富山',
      status: 'visited',
      photoIds: [],
      areaTagIds: [],
      genreTagIds: [],
      useTagIds: [],
      origin: 'self',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    })
    expect(await getShop(shop.id)).toEqual(shop)
  })

  it('accepts optional fields', async () => {
    const genre = await findOrCreateTag('genre', 'ラーメン')
    const shop = await createShop({
      name: '麺屋',
      status: 'wishlist',
      rating: 37,
      prefecture: '富山県',
      city: '富山市',
      stationId: 'st-1',
      mapUrl: 'https://maps.app.goo.gl/x',
      memo: 'メモ',
      genreTagIds: [genre.id, genre.id],
    })
    expect(shop.status).toBe('wishlist')
    expect(shop.rating).toBe(37)
    expect(shop.genreTagIds).toEqual([genre.id])
    expect((await getShop(shop.id))?.memo).toBe('メモ')
  })

  it('stores blank optional strings as not set', async () => {
    const shop = await createShop({ name: 'a', memo: '  ', mapUrl: '' })
    expect('memo' in shop).toBe(false)
    expect('mapUrl' in shop).toBe(false)
  })

  it.each([0, 51, 3.7, NaN])('rejects invalid rating %s', async (rating) => {
    await expect(createShop({ name: 'a', rating })).rejects.toBeInstanceOf(ValidationError)
  })

  it('rejects unknown or wrong-kind tag ids', async () => {
    const area = await findOrCreateTag('area', '総曲輪')
    await expect(createShop({ name: 'a', genreTagIds: ['nope'] })).rejects.toBeInstanceOf(RecordNotFoundError)
    await expect(createShop({ name: 'a', genreTagIds: [area.id] })).rejects.toBeInstanceOf(ValidationError)
  })
})

describe('updateShop', () => {
  beforeEach(resetDbAndClock)

  it('updates fields, bumps updatedAt, keeps createdAt', async () => {
    const shop = await createShop({ name: 'a' })
    const updated = await updateShop(shop.id, { name: ' b ', rating: 42 })
    expect(updated.name).toBe('b')
    expect(updated.rating).toBe(42)
    expect(updated.createdAt).toBe(shop.createdAt)
    expect(updated.updatedAt > shop.updatedAt).toBe(true)
    expect(await getShop(shop.id)).toEqual(updated)
  })

  it('clears an optional field with undefined', async () => {
    const shop = await createShop({ name: 'a', rating: 30, memo: 'x' })
    const updated = await updateShop(shop.id, { rating: undefined, memo: undefined })
    expect('rating' in updated).toBe(false)
    expect('memo' in updated).toBe(false)
  })

  it.each(['', '  '])('rejects a blank name (%j)', async (name) => {
    const shop = await createShop({ name: 'a' })
    await expect(updateShop(shop.id, { name })).rejects.toBeInstanceOf(ValidationError)
    expect((await getShop(shop.id))?.name).toBe('a')
  })

  it('rejects invalid rating', async () => {
    const shop = await createShop({ name: 'a' })
    await expect(updateShop(shop.id, { rating: 51 })).rejects.toBeInstanceOf(ValidationError)
    await expect(updateShop(shop.id, { rating: 3.7 })).rejects.toBeInstanceOf(ValidationError)
  })

  it.each(['id', 'createdAt', 'updatedAt', 'photoIds'])('does not allow changing %s', async (key) => {
    const shop = await createShop({ name: 'a' })
    const patch = { [key]: key === 'photoIds' ? [] : 'x' } as unknown as ShopPatch
    await expect(updateShop(shop.id, patch)).rejects.toBeInstanceOf(ValidationError)
    expect(await getShop(shop.id)).toEqual(shop)
  })

  it('throws RecordNotFoundError for a missing shop', async () => {
    await expect(updateShop('missing', { name: 'x' })).rejects.toBeInstanceOf(RecordNotFoundError)
  })
})

describe('deleteShop', () => {
  beforeEach(resetDbAndClock)

  it('deletes the shop and its photos, leaving other shops alone', async () => {
    const a = await createShop({ name: 'a' })
    const b = await createShop({ name: 'b' })
    await addPhoto(a.id, photoInput())
    await addPhoto(a.id, photoInput())
    const bPhoto = await addPhoto(b.id, photoInput())
    await deleteShop(a.id)
    expect(await getShop(a.id)).toBeUndefined()
    expect(await db.photos.where('shopId').equals(a.id).count()).toBe(0)
    expect(await db.photos.toArray()).toEqual([bPhoto])
    expect(await getShop(b.id)).toBeDefined()
  })

  it('is a no-op for a missing shop', async () => {
    await expect(deleteShop('missing')).resolves.toBeUndefined()
  })
})

describe('listShops / countShops', () => {
  beforeEach(resetDbAndClock)

  async function seed() {
    // created in this order (createdAt increases by 1s each)
    const s1 = await createShop({ name: 'いろは', rating: 30 })
    const s2 = await createShop({ name: 'Aラーメン' }) // unrated
    const s3 = await createShop({ name: 'かもめ', rating: 45, status: 'wishlist' })
    const s4 = await createShop({ name: 'あさひ', rating: 45 })
    const s5 = await createShop({ name: 'うお', status: 'wishlist' }) // unrated
    return { s1, s2, s3, s4, s5 }
  }

  it('defaults to all shops, newest first', async () => {
    const { s1, s2, s3, s4, s5 } = await seed()
    expect((await listShops()).map((s) => s.id)).toEqual([s5, s4, s3, s2, s1].map((s) => s.id))
  })

  it('filters by status', async () => {
    const { s3, s5 } = await seed()
    expect((await listShops({ status: 'wishlist' })).map((s) => s.id)).toEqual([s5.id, s3.id])
    expect(await listShops({ status: 'visited' })).toHaveLength(3)
  })

  it('sorts by rating desc, ties newest first, unrated last', async () => {
    const { s1, s2, s3, s4, s5 } = await seed()
    expect((await listShops({ sort: 'rating' })).map((s) => s.id)).toEqual([s4, s3, s1, s5, s2].map((s) => s.id))
  })

  it('sorts by name in Japanese locale order', async () => {
    const { s1, s2, s3, s4, s5 } = await seed()
    const names = (await listShops({ sort: 'name' })).map((s) => s.name)
    const expected = [s1, s2, s3, s4, s5].map((s) => s.name).sort(new Intl.Collator('ja').compare)
    expect(names).toEqual(expected)
    // kana order: あ < い < う < か
    const kana = names.filter((n) => n !== 'Aラーメン')
    expect(kana).toEqual(['あさひ', 'いろは', 'うお', 'かもめ'])
  })

  it('counts all or by status', async () => {
    await seed()
    expect(await countShops()).toBe(5)
    expect(await countShops('visited')).toBe(3)
    expect(await countShops('wishlist')).toBe(2)
  })
})
