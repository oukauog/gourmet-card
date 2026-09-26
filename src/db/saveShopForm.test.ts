import { beforeEach, describe, expect, it } from 'vitest'
import { emptyShopForm, shopFormToData, type ShopFormData } from '../lib/shopForm'
import { createShopWithPhotos } from './createShopWithPhotos'
import { PhotoLimitError, RecordNotFoundError, ValidationError } from './errors'
import { getPhotosForShop } from './photos'
import { deleteShop, getShop, updateShop } from './shops'
import { createShopFromForm, saveShopEdit, type PhotoSlot } from './saveShopForm'
import { findOrCreateTag, listTags } from './tags'
import { blobOf, bytesOf, resetDbAndClock } from './testHelpers'
import type { PhotoInput } from './types'

const photo = (n: number): PhotoInput => ({ small: blobOf([n]), large: blobOf([n, n]), width: 10, height: 10 })
const data = (patch: Partial<ShopFormData>): ShopFormData => ({ ...shopFormToData({ ...emptyShopForm(), name: '店' }), ...patch })
const smallBytes = async (shopId: string) => Promise.all((await getPhotosForShop(shopId)).map(async (p) => (await bytesOf(p.small))[0]))

describe('createShopFromForm', () => {
  beforeEach(resetDbAndClock)

  it('saves every field, the photos in order and the new tags', async () => {
    const ramen = await findOrCreateTag('genre', 'ラーメン')
    const shop = await createShopFromForm(
      data({
        name: '麺屋',
        status: 'wishlist',
        rating: 37,
        prefecture: '富山県',
        mapUrl: 'https://maps.app.goo.gl/x',
        memo: '1行目\n2行目',
        genres: [{ id: ramen.id, name: 'ラーメン' }, { name: '海鮮' }],
        uses: [{ name: '個室あり' }],
        areas: [{ name: '総曲輪' }, { name: '八尾' }],
      }),
      [photo(1), photo(2)],
    )
    const s = (await getShop(shop.id))!
    expect([s.name, s.status, s.rating, s.prefecture, s.mapUrl, s.memo]).toEqual(['麺屋', 'wishlist', 37, '富山県', 'https://maps.app.goo.gl/x', '1行目\n2行目'])
    const tags = new Map((await listTags()).map((t) => [t.id, t]))
    expect(s.genreTagIds.map((id) => tags.get(id)!.name)).toEqual(['ラーメン', '海鮮'])
    expect(s.genreTagIds[0]).toBe(ramen.id)
    expect(s.useTagIds.map((id) => tags.get(id)!.name)).toEqual(['個室あり'])
    expect(s.areaTagIds.map((id) => [tags.get(id)!.kind, tags.get(id)!.name])).toEqual([
      ['area', '総曲輪'],
      ['area', '八尾'],
    ])
    expect(await smallBytes(s.id)).toEqual([1, 2])
  })

  it('name only: everything else is not set', async () => {
    const shop = await createShopFromForm(data({ name: '店名だけ' }), [])
    expect(shop).toMatchObject({ name: '店名だけ', status: 'visited', genreTagIds: [], useTagIds: [], areaTagIds: [], photoIds: [] })
    for (const k of ['rating', 'prefecture', 'city', 'mapUrl', 'memo', 'stationId']) expect(k in shop).toBe(false)
  })

  it('on failure nothing is saved (no shop, no new tag)', async () => {
    await expect(createShopFromForm(data({ name: '  ', genres: [{ name: '新タグ' }] }), [])).rejects.toBeInstanceOf(ValidationError)
    await expect(createShopFromForm(data({ genres: [{ name: '新タグ' }] }), [photo(1), photo(2), photo(3), photo(4)])).rejects.toBeInstanceOf(
      PhotoLimitError,
    )
    expect(await listTags()).toEqual([])
    const { listShops } = await import('./shops')
    expect(await listShops()).toEqual([])
  })
})

describe('saveShopEdit', () => {
  beforeEach(resetDbAndClock)

  async function seedShop() {
    const area = await findOrCreateTag('area', '総曲輪')
    const s = await createShopWithPhotos({ name: '元', prefecture: '富山県', city: '富山市', stationId: 'st-1', areaTagIds: [area.id] }, [
      photo(1),
      photo(2),
      photo(3),
    ])
    return { shop: s, area }
  }

  it('reorders, removes and adds photos at once, and updates the fields', async () => {
    const { shop, area } = await seedShop()
    const [p1, , p3] = shop.photoIds
    // final order: 3, new(9), 1  (2 removed)
    const slots: PhotoSlot[] = [{ photoId: p3 }, { photo: photo(9) }, { photoId: p1 }]
    const saved = await saveShopEdit(
      shop.id,
      data({ name: '新しい名前', rating: 42, prefecture: '富山県', areas: [{ id: area.id, name: '総曲輪' }], memo: 'メモ' }),
      slots,
    )
    expect(saved.photoIds).toHaveLength(3)
    expect(saved.photoIds[0]).toBe(p3)
    expect(saved.photoIds[2]).toBe(p1)
    expect(await smallBytes(shop.id)).toEqual([3, 9, 1])
    expect([saved.name, saved.rating, saved.memo]).toEqual(['新しい名前', 42, 'メモ'])
    // same prefecture: city and station untouched
    expect([saved.city, saved.stationId]).toEqual(['富山市', 'st-1'])
  })

  it('changing the prefecture clears the city; the station is never touched', async () => {
    const { shop } = await seedShop()
    const keep: PhotoSlot[] = shop.photoIds.map((photoId) => ({ photoId }))
    const s1 = await saveShopEdit(shop.id, data({ prefecture: '石川県' }), keep)
    expect(s1.prefecture).toBe('石川県')
    expect('city' in s1).toBe(false)
    expect(s1.stationId).toBe('st-1')
    await updateShop(shop.id, { city: '金沢市' })
    const s2 = await saveShopEdit(shop.id, data({ prefecture: undefined }), keep)
    expect('prefecture' in s2 || 'city' in s2).toBe(false)
    expect(s2.stationId).toBe('st-1')
  })

  it('creates new tags only when saving, reuses existing ones', async () => {
    const { shop } = await seedShop()
    const keep: PhotoSlot[] = shop.photoIds.map((photoId) => ({ photoId }))
    expect((await listTags()).map((t) => t.name)).toEqual(['総曲輪'])
    const s = await saveShopEdit(shop.id, data({ genres: [{ name: 'カフェ' }], areas: [{ name: '総曲輪' }], uses: [] }), keep)
    const tags = await listTags()
    expect(tags.map((t) => t.name).sort()).toEqual(['カフェ', '総曲輪'].sort())
    expect(s.areaTagIds).toEqual([tags.find((t) => t.name === '総曲輪')!.id])
  })

  it('on failure nothing changes: over the photo limit', async () => {
    const { shop } = await seedShop()
    const before = await getShop(shop.id)
    const slots: PhotoSlot[] = [...shop.photoIds.map((photoId) => ({ photoId })), { photo: photo(9) }]
    await expect(saveShopEdit(shop.id, data({ name: '変えた', genres: [{ name: '新タグ' }] }), slots)).rejects.toBeInstanceOf(PhotoLimitError)
    expect(await getShop(shop.id)).toEqual(before)
    expect(await smallBytes(shop.id)).toEqual([1, 2, 3])
    expect((await listTags()).map((t) => t.name)).toEqual(['総曲輪'])
  })

  it('on failure nothing changes: a photo id that is not the shop (stale screen)', async () => {
    const { shop } = await seedShop()
    const before = await getShop(shop.id)
    const slots: PhotoSlot[] = [{ photoId: shop.photoIds[0] }, { photoId: 'not-a-photo' }]
    await expect(saveShopEdit(shop.id, data({ name: '変えた' }), slots)).rejects.toBeInstanceOf(ValidationError)
    expect(await getShop(shop.id)).toEqual(before)
    expect(await smallBytes(shop.id)).toEqual([1, 2, 3])
  })

  it('on failure nothing changes: the shop was deleted meanwhile', async () => {
    const { shop } = await seedShop()
    await deleteShop(shop.id)
    await expect(saveShopEdit(shop.id, data({ genres: [{ name: '新タグ' }] }), [])).rejects.toBeInstanceOf(RecordNotFoundError)
    expect((await listTags()).map((t) => t.name)).toEqual(['総曲輪'])
  })

  it('status can be changed (wishlist -> visited)', async () => {
    const s = await createShopWithPhotos({ name: '行きたい店', status: 'wishlist' }, [])
    expect((await saveShopEdit(s.id, data({ name: '行きたい店', status: 'visited' }), [])).status).toBe('visited')
  })
})
