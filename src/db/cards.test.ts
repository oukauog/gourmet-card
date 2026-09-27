// Export -> import round trips (construction 8). THE backup lifeline: everything must come back
// exactly (spec 6). Each test builds data through the public API, writes a file, empties the
// database (= another / a new phone) and imports it.
import { beforeEach, describe, expect, it } from 'vitest'
import { CARD_FILE_TYPES } from '../lib/cardFileType'
import { CardFileError, ENTRY } from '../lib/cardFormat'
import { setClock } from '../lib/time'
import { buildZip } from '../lib/zipStore'
import { createShopWithPhotos } from './createShopWithPhotos'
import { db } from './db'
import { exportBackup, exportShopCard } from './exportCards'
import { importCard, previewCard } from './importCards'
import { addPhoto, getPhotosForShop } from './photos'
import { getShop, listShops } from './shops'
import { findOrCreateTag, listTags } from './tags'
import { bytesOf, resetDbAndClock } from './testHelpers'
import type { PhotoInput, Shop } from './types'

const GCARD = CARD_FILE_TYPES.gcard

/** A photo whose bytes are unique (so a broken byte can be found and the images told apart). */
const photo = (n: number, w = 1800, h = 1350): PhotoInput => ({
  large: new Blob([new Uint8Array(Array.from({ length: 300 + n }, (_, i) => (n * 31 + i) % 256))], { type: 'image/jpeg' }),
  small: new Blob([new Uint8Array(Array.from({ length: 40 + n }, (_, i) => (n * 17 + i * 3) % 256))], { type: 'image/jpeg' }),
  width: w,
  height: h,
})

/** Everything in the database, in a comparable form (photo bytes included, ordered by id). */
async function snapshot() {
  const shops = (await db.shops.toArray()).sort((a, b) => (a.id < b.id ? -1 : 1))
  const photos = await Promise.all(
    (await db.photos.toArray())
      .sort((a, b) => (a.id < b.id ? -1 : 1))
      .map(async (p) => ({
        id: p.id,
        shopId: p.shopId,
        width: p.width,
        height: p.height,
        createdAt: p.createdAt,
        large: await bytesOf(p.large),
        small: await bytesOf(p.small),
        types: [p.large.type, p.small.type],
      })),
  )
  const tags = (await db.tags.toArray()).sort((a, b) => (a.id < b.id ? -1 : 1))
  return { shops, photos, tags }
}

/** A varied set of shops: both tabs, rated / unrated, every optional field present or not, 0..3 photos, an unused tag. */
async function seedVaried() {
  const ramen = await findOrCreateTag('genre', 'ラーメン')
  const kaisen = await findOrCreateTag('genre', '海鮮')
  const koshitsu = await findOrCreateTag('use', '個室あり')
  const parking = await findOrCreateTag('use', '駐車場あり')
  const sogawa = await findOrCreateTag('area', '総曲輪')
  await findOrCreateTag('genre', 'どの店にも付いていない') // unused tag
  await findOrCreateTag('area', '八尾') // unused tag

  const full = await createShopWithPhotos(
    {
      name: '白えび亭',
      status: 'visited',
      rating: 37,
      prefecture: '富山県',
      city: '富山市',
      stationId: '1140501',
      mapUrl: 'https://maps.app.goo.gl/abc',
      memo: '1行目\n2行目 🍤',
      genreTagIds: [ramen.id, kaisen.id],
      useTagIds: [koshitsu.id, parking.id],
      areaTagIds: [sogawa.id],
    },
    [photo(1), photo(2, 1350, 1800), photo(3)],
  )
  const wish = await createShopWithPhotos({ name: '行きたい店', status: 'wishlist', genreTagIds: [kaisen.id] }, [photo(4)])
  const plain = await createShopWithPhotos({ name: '名前だけ' }, [])
  const shared = await createShopWithPhotos({ name: 'もらった店', origin: 'shared', status: 'wishlist', rating: 50, city: '高岡市' }, [photo(5), photo(6)])
  const odd = await createShopWithPhotos({ name: '駅がマスタに無い店', stationId: 'no-such-station', rating: 1, prefecture: '石川県' }, [])
  return { full, wish, plain, shared, odd, tags: { ramen, kaisen, koshitsu, parking, sogawa } }
}

describe('backup round trip (the lifeline)', () => {
  beforeEach(resetDbAndClock)

  it('every shop, photo (both sizes, byte for byte), tag, date, status, origin and photo order comes back exactly', async () => {
    const { full } = await seedVaried()
    // a photo order that is not the adding order
    const reordered = [full.photoIds[2], full.photoIds[0], full.photoIds[1]]
    await db.shops.update(full.id, { photoIds: reordered })
    const before = await snapshot()
    expect(before.shops).toHaveLength(5)
    expect(before.photos).toHaveLength(6)
    expect(before.tags).toHaveLength(7)

    const progress: string[] = []
    const file = await exportBackup(GCARD, (p) => progress.push(`${p.photosDone}/${p.photosTotal}`))
    expect([file.kind, file.shopCount, file.photoCount]).toEqual(['backup', 5, 6])
    expect(progress[0]).toBe('0/6')
    expect(progress.at(-1)).toBe('6/6')
    expect(file.fileName).toMatch(/^グルメカード_バックアップ_\d{8}-\d{4}\.gcard$/)

    await resetDbAndClock() // an empty phone
    expect(await listShops()).toEqual([])
    const preview = await previewCard(file.blob)
    expect([preview.kind, preview.newIds.length, preview.existingIds.length, preview.skippedShops, preview.skippedPhotos]).toEqual(['backup', 5, 0, 0, 0])
    const result = await importCard(preview, { overwrite: false })
    expect(result).toMatchObject({ added: 5, overwritten: 0, keptExisting: 0, failed: 0, skippedShops: 0, skippedPhotos: 0 })

    const after = await snapshot()
    // strict: missing (undefined) fields must stay missing, not become undefined keys
    expect(after.shops).toStrictEqual(before.shops)
    expect(after.photos).toStrictEqual(before.photos)
    expect(after.tags).toStrictEqual(before.tags)
    expect((await getShop(full.id))!.photoIds).toEqual(reordered)
    // the photo API still sees the order
    expect((await getPhotosForShop(full.id)).map((p) => p.id)).toEqual(reordered)
  })

  it('a backup of an empty phone is a valid file', async () => {
    const file = await exportBackup(GCARD)
    const preview = await previewCard(file.blob)
    expect([preview.shops.length, preview.tags.length]).toEqual([0, 0])
    expect(await importCard(preview, { overwrite: false })).toMatchObject({ added: 0, failed: 0 })
  })

  it('a second round trip (import -> export -> import) is still identical', async () => {
    await seedVaried()
    const before = await snapshot()
    const f1 = await exportBackup(GCARD)
    await resetDbAndClock()
    await importCard(await previewCard(f1.blob), { overwrite: false })
    const f2 = await exportBackup(CARD_FILE_TYPES.zip)
    expect(f2.fileName.endsWith('.zip')).toBe(true)
    await resetDbAndClock()
    await importCard(await previewCard(f2.blob), { overwrite: false })
    const after = await snapshot()
    expect(after).toStrictEqual(before)
  })
})

describe('share one shop', () => {
  beforeEach(resetDbAndClock)

  it('another phone gets it as 行きたい / もらった, dated when imported; the rest is the same', async () => {
    const { full } = await seedVaried()
    const sent = (await getShop(full.id))!
    const sentPhotos = (await snapshot()).photos.filter((p) => p.shopId === full.id)
    const file = await exportShopCard(full.id, GCARD)
    expect([file.kind, file.shopCount, file.photoCount, file.fileName]).toEqual(['share', 1, 3, 'グルメカード_白えび亭.gcard'])

    await resetDbAndClock()
    setClock(() => '2026-10-01T03:04:05.000Z')
    const preview = await previewCard(file.blob)
    expect([preview.kind, preview.newIds, preview.existingIds]).toEqual(['share', [full.id], []])
    // only the tags of this shop
    expect(preview.tags.map((t) => t.name).sort()).toEqual(['個室あり', '海鮮', '総曲輪', '駐車場あり', 'ラーメン'].sort())
    await importCard(preview, { overwrite: false })

    const got = (await getShop(full.id))!
    const { status, origin, createdAt, updatedAt, genreTagIds, useTagIds, areaTagIds, ...rest } = got
    const { status: _s, origin: _o, createdAt: _c, updatedAt: _u, genreTagIds: _g, useTagIds: _us, areaTagIds: _a, ...sentRest } = sent
    expect([status, origin, createdAt, updatedAt]).toEqual(['wishlist', 'shared', '2026-10-01T03:04:05.000Z', '2026-10-01T03:04:05.000Z'])
    expect(rest).toStrictEqual(sentRest) // id, name, rating, place, station, URL, memo, photoIds
    const names = async (ids: string[]) => Promise.all(ids.map(async (id) => (await db.tags.get(id))!.name))
    expect(await names(genreTagIds)).toEqual(['ラーメン', '海鮮'])
    expect(await names(useTagIds)).toEqual(['個室あり', '駐車場あり'])
    expect(await names(areaTagIds)).toEqual(['総曲輪'])
    // unused tags of the sender are not brought
    expect((await listTags()).map((t) => t.name)).not.toContain('どの店にも付いていない')
    const gotPhotos = (await snapshot()).photos
    expect(gotPhotos).toStrictEqual(sentPhotos)
  })
})

describe('a shop that is already here (same id)', () => {
  beforeEach(resetDbAndClock)

  it('default: kept as it is; overwrite: replaced, and its old photos are gone', async () => {
    const { full } = await seedVaried()
    const file = await exportShopCard(full.id, GCARD)
    // the receiver changed it meanwhile: new name, rating, one extra photo removed / added
    await db.shops.update(full.id, { name: '自分で直した名前', rating: 45 })
    const oldPhotoIds = (await getShop(full.id))!.photoIds
    const mine = await snapshot()

    const preview = await previewCard(file.blob)
    expect([preview.newIds, preview.existingIds]).toEqual([[], [full.id]])
    expect(await importCard(preview, { overwrite: false })).toMatchObject({ added: 0, overwritten: 0, keptExisting: 1, shopIds: [] })
    expect(await snapshot()).toStrictEqual(mine)

    // make the photo ids of the file different from the ones here, to see the old ones go
    await db.transaction('rw', db.shops, db.photos, async () => {
      for (const id of oldPhotoIds) await db.photos.delete(id)
      await db.shops.update(full.id, { photoIds: [] })
    })
    await addPhoto(full.id, photo(9))
    const extraId = (await getShop(full.id))!.photoIds[0]

    const r = await importCard(await previewCard(file.blob), { overwrite: true })
    expect(r).toMatchObject({ added: 0, overwritten: 1, keptExisting: 0, shopIds: [full.id] })
    const s = (await getShop(full.id))!
    expect([s.name, s.rating, s.status, s.origin]).toEqual(['白えび亭', 37, 'wishlist', 'shared'])
    expect(s.photoIds).toEqual(oldPhotoIds)
    expect(await db.photos.get(extraId)).toBeUndefined()
    expect(await db.photos.where('shopId').equals(full.id).count()).toBe(3)
  })

  it('backup restore: shops already here are kept by default, the others are added', async () => {
    const { plain } = await seedVaried()
    const file = await exportBackup(GCARD)
    await db.shops.delete(plain.id)
    await db.shops.update((await listShops())[0].id, { name: '変えた' })
    const r = await importCard(await previewCard(file.blob), { overwrite: false })
    expect(r).toMatchObject({ added: 1, keptExisting: 4, shopIds: [plain.id] })
    expect((await listShops()).some((s) => s.name === '変えた')).toBe(true)
  })
})

describe('tags and ids', () => {
  beforeEach(resetDbAndClock)

  it('merges into a tag here with the same normalized key (full / half width, case); the name here stays', async () => {
    const t1 = await findOrCreateTag('genre', 'ﾗｰﾒﾝ') // half-width katakana
    const t2 = await findOrCreateTag('use', 'wi-fi')
    const s = await createShopWithPhotos({ name: '送る店', genreTagIds: [t1.id], useTagIds: [t2.id] }, [])
    const file = await exportShopCard(s.id, GCARD)
    await resetDbAndClock()
    const here1 = await findOrCreateTag('genre', 'ラーメン') // full-width: same key
    const here2 = await findOrCreateTag('use', 'Wi-Fi')
    await importCard(await previewCard(file.blob), { overwrite: false })
    const got = (await getShop(s.id))!
    expect(got.genreTagIds).toEqual([here1.id])
    expect(got.useTagIds).toEqual([here2.id])
    expect((await listTags()).map((t) => t.name).sort()).toEqual(['ラーメン', 'Wi-Fi'].sort())
  })

  it('a tag id already used here by another tag gets a new id; a photo id used by another shop gets a new id', async () => {
    const tag = await findOrCreateTag('genre', 'カフェ')
    const s = await createShopWithPhotos({ name: '送る店', genreTagIds: [tag.id] }, [photo(1)])
    const photoId = s.photoIds[0]
    const file = await exportShopCard(s.id, GCARD)
    await resetDbAndClock()
    // on this phone, the same ids belong to something else
    await db.tags.add({ id: tag.id, kind: 'area', name: '別のタグ', normalizedKey: '別のタグ', createdAt: '2026-01-01T00:00:00.000Z' })
    const other = await createShopWithPhotos({ name: '別の店' }, [])
    await db.photos.add({ id: photoId, shopId: other.id, ...photo(7), createdAt: '2026-01-01T00:00:00.000Z' })

    await importCard(await previewCard(file.blob), { overwrite: false })
    const got = (await getShop(s.id))!
    expect(got.genreTagIds).toHaveLength(1)
    expect(got.genreTagIds[0]).not.toBe(tag.id)
    expect((await db.tags.get(got.genreTagIds[0]))!.name).toBe('カフェ')
    expect((await db.tags.get(tag.id))!.name).toBe('別のタグ')
    expect(got.photoIds).toHaveLength(1)
    expect(got.photoIds[0]).not.toBe(photoId)
    expect((await db.photos.get(photoId))!.shopId).toBe(other.id)
    expect(await bytesOf((await db.photos.get(got.photoIds[0]))!.large)).toEqual(await bytesOf(photo(1).large))
  })
})

// ---------- broken / foreign files ----------

const enc = (v: unknown) => () => new Blob([typeof v === 'string' ? v : JSON.stringify(v)])
const MANIFEST = { format: 'gourmet-card', formatVersion: 1, kind: 'share', exportedAt: '2026-09-27T12:00:00.000Z', appVersion: 'test', shopCount: 1, photoCount: 0 }
const GOOD_SHOP: Partial<Shop> = {
  id: 'shop-1',
  name: '正しい店',
  status: 'visited',
  origin: 'self',
  photoIds: [],
  genreTagIds: [],
  useTagIds: [],
  areaTagIds: [],
  createdAt: '2026-09-01T00:00:00Z',
  updatedAt: '2026-09-01T09:00:00+09:00',
}

async function zipOf(files: Record<string, unknown>) {
  return buildZip(
    Object.entries(files).map(([name, v]) => ({ name, load: enc(v) })),
    new Date(),
  )
}

describe('files that are not right', () => {
  beforeEach(resetDbAndClock)

  const code = async (blob: Blob) => {
    try {
      await previewCard(blob)
      return 'ok'
    } catch (e) {
      return e instanceof CardFileError ? `${e.code}: ${e.userMessage}` : `other: ${String(e)}`
    }
  }

  it('not a ZIP / no manifest / another format -> "グルメカードのファイルではありません"', async () => {
    const msg = 'not-card: グルメカードのファイルではありません'
    expect(await code(new Blob(['just text']))).toBe(msg)
    expect(await code(await zipOf({ 'shops.json': [] }))).toBe(msg)
    expect(await code(await zipOf({ 'manifest.json': { ...MANIFEST, format: 'other-app' } }))).toBe(msg)
    expect(await code(await zipOf({ 'manifest.json': 'not json' }))).toBe(msg)
  })

  it('a newer format version is refused with its message', async () => {
    expect(await code(await zipOf({ 'manifest.json': { ...MANIFEST, formatVersion: 2 } }))).toBe(
      'too-new: 新しい版のアプリで作られたファイルです。アプリを新しくしてから取り込んでください',
    )
  })

  it('broken shops are skipped one by one and counted; dates are normalized to ISO', async () => {
    const shops = [
      GOOD_SHOP,
      { ...GOOD_SHOP, id: 'blank-name', name: '   ' },
      { ...GOOD_SHOP, id: 'bad-status', status: 'eaten' },
      { ...GOOD_SHOP, id: 'bad-rating', rating: 3.7 },
      { ...GOOD_SHOP, id: 'four-photos', photoIds: ['a', 'b', 'c', 'd'] },
      { ...GOOD_SHOP, id: 'bad-tags', genreTagIds: 'ラーメン' },
      { ...GOOD_SHOP, id: 'bad-date', createdAt: 'someday' },
      { ...GOOD_SHOP, name: '同じ id の2件目' },
      'not an object',
    ]
    const file = await zipOf({ 'manifest.json': MANIFEST, 'shops.json': shops, 'tags.json': [], 'photos.json': [] })
    const preview = await previewCard(file)
    expect(preview.shops.map((s) => s.id)).toEqual(['shop-1'])
    expect(preview.skippedShops).toBe(8)
    const r = await importCard({ ...preview, kind: 'backup' }, { overwrite: false })
    expect(r).toMatchObject({ added: 1, skippedShops: 8 })
    const s = (await getShop('shop-1'))!
    expect([s.createdAt, s.updatedAt]).toEqual(['2026-09-01T00:00:00.000Z', '2026-09-01T00:00:00.000Z'])
  })

  it('a photo whose bytes are broken (CRC) or missing is left out; the shop is imported', async () => {
    const s = await createShopWithPhotos({ name: '写真の店' }, [photo(1), photo(2)])
    const file = await exportShopCard(s.id, GCARD)
    // break one byte inside the first photo's large image
    const buf = new Uint8Array(await file.blob.arrayBuffer())
    const needle = await bytesOf(photo(1).large)
    let at = -1
    for (let i = 0; i < buf.length - 8 && at < 0; i++) if (needle.slice(0, 8).every((b, k) => buf[i + k] === b)) at = i
    expect(at).toBeGreaterThan(0)
    buf[at + 50] ^= 0xff
    await resetDbAndClock()
    const preview = await previewCard(new Blob([buf]))
    expect(preview.skippedPhotos).toBe(0) // found only when reading the image
    const r = await importCard(preview, { overwrite: false })
    expect(r).toMatchObject({ added: 1, skippedPhotos: 1, failed: 0 })
    const got = (await getShop(s.id))!
    expect(got.photoIds).toEqual([s.photoIds[1]])

    // an image entry missing from the file: skipped already in the preview
    const meta = [{ id: 'p1', shopId: 'shop-1', width: 10, height: 10, createdAt: '2026-09-01T00:00:00Z' }]
    const noImage = await zipOf({
      'manifest.json': MANIFEST,
      'shops.json': [{ ...GOOD_SHOP, photoIds: ['p1'] }],
      'tags.json': [],
      'photos.json': meta,
      [ENTRY.large('p1')]: 'x',
    })
    const p2 = await previewCard(noImage)
    expect([p2.shops[0].photoIds, p2.skippedPhotos]).toEqual([[], 1])
  })

  it('tag ids that are not in the file (or of another kind) are dropped from the shop', async () => {
    const tags = [{ id: 't1', kind: 'genre', name: 'ラーメン', normalizedKey: 'x', createdAt: '2026-09-01T00:00:00Z' }]
    const file = await zipOf({
      'manifest.json': MANIFEST,
      'shops.json': [{ ...GOOD_SHOP, genreTagIds: ['t1', 'missing'], areaTagIds: ['t1'] }],
      'tags.json': tags,
      'photos.json': [],
    })
    await importCard(await previewCard(file), { overwrite: false })
    const s = (await getShop('shop-1'))!
    expect(s.genreTagIds).toHaveLength(1)
    expect((await db.tags.get(s.genreTagIds[0]))!.normalizedKey).toBe('ラーメン') // recomputed, not trusted
    expect(s.areaTagIds).toEqual([])
  })
})
