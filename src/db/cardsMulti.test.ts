// Several shops in one file (construction 8b): export -> import on an empty phone.
import { beforeEach, describe, expect, it } from 'vitest'
import { CARD_FILE_TYPE } from '../lib/cardFileType'
import { cardFileName, ENTRY } from '../lib/cardFormat'
import { openZip } from '../lib/zipStore'
import { createShopWithPhotos } from './createShopWithPhotos'
import { db } from './db'
import { RecordNotFoundError, ValidationError } from './errors'
import { exportShopCard, exportShopsCard } from './exportCards'
import { importCard, previewCard } from './importCards'
import { getShop } from './shops'
import { findOrCreateTag, listTags } from './tags'
import { bytesOf, resetDbAndClock } from './testHelpers'
import type { PhotoInput } from './types'

const photo = (n: number): PhotoInput => ({
  large: new Blob([new Uint8Array(Array.from({ length: 200 + n }, (_, i) => (n * 13 + i) % 256))], { type: 'image/jpeg' }),
  small: new Blob([new Uint8Array(Array.from({ length: 30 + n }, (_, i) => (n * 7 + i) % 256))], { type: 'image/jpeg' }),
  width: 1800,
  height: 1350,
})

async function seedThree() {
  const ramen = await findOrCreateTag('genre', 'ラーメン')
  const sushi = await findOrCreateTag('genre', '寿司')
  const room = await findOrCreateTag('use', '個室あり')
  const area = await findOrCreateTag('area', '総曲輪')
  await findOrCreateTag('genre', '送らないタグ')
  const a = await createShopWithPhotos({ name: '一番の店', rating: 45, memo: 'A', prefecture: '富山県', city: '富山市', genreTagIds: [ramen.id], areaTagIds: [area.id] }, [photo(1), photo(2), photo(3)])
  const b = await createShopWithPhotos({ name: '二番の店', status: 'wishlist', genreTagIds: [ramen.id, sushi.id], useTagIds: [room.id] }, [])
  const c = await createShopWithPhotos({ name: '三番の店', rating: 30, memo: 'C', stationId: '1140501', areaTagIds: [area.id] }, [photo(4)])
  const other = await createShopWithPhotos({ name: '選ばない店' }, [photo(5)])
  return { a, b, c, other }
}

/** The things that must stay the same on the receiving phone. */
async function kept(id: string) {
  const s = (await getShop(id))!
  const photos = await Promise.all(
    s.photoIds.map(async (pid) => {
      const p = (await db.photos.get(pid))!
      return [pid, p.width, p.height, p.createdAt, await bytesOf(p.large), await bytesOf(p.small)]
    }),
  )
  const names = async (ids: string[]) => Promise.all(ids.map(async (t) => (await db.tags.get(t))!.name))
  return {
    name: s.name,
    rating: s.rating,
    memo: s.memo,
    prefecture: s.prefecture,
    city: s.city,
    stationId: s.stationId,
    photos,
    genres: await names(s.genreTagIds),
    uses: await names(s.useTagIds),
    areas: await names(s.areaTagIds),
  }
}

describe('exportShopsCard', () => {
  beforeEach(resetDbAndClock)

  it('3 shops (0..3 photos, shared tags, a 行きたい shop) -> an empty phone gets all 3 as 行きたい / もらった; the rest is the same', async () => {
    const { a, b, c } = await seedThree()
    const before = [await kept(a.id), await kept(b.id), await kept(c.id)]
    const file = await exportShopsCard([c.id, a.id, b.id], CARD_FILE_TYPE)
    expect([file.kind, file.shopCount, file.photoCount, file.mime]).toEqual(['share', 3, 4, 'application/zip'])
    expect(file.fileName).toBe('グルメカード_三番の店ほか2店.zip')

    // in the file: the given order, only the tags on these shops (no duplicates)
    const zip = await openZip(file.blob)
    const shops = JSON.parse(await zip.text(ENTRY.shops)) as { name: string }[]
    expect(shops.map((s) => s.name)).toEqual(['三番の店', '一番の店', '二番の店'])
    const tags = JSON.parse(await zip.text(ENTRY.tags)) as { name: string }[]
    expect(tags.map((t) => t.name).sort()).toEqual(['ラーメン', '寿司', '個室あり', '総曲輪'].sort())

    await resetDbAndClock()
    const preview = await previewCard(file.blob)
    expect([preview.kind, preview.newIds]).toEqual(['share', [c.id, a.id, b.id]])
    expect(await importCard(preview, { overwrite: false })).toMatchObject({ added: 3, failed: 0, skippedPhotos: 0 })
    for (const id of [a.id, b.id, c.id]) expect([(await getShop(id))!.status, (await getShop(id))!.origin]).toEqual(['wishlist', 'shared'])
    expect([await kept(a.id), await kept(b.id), await kept(c.id)]).toStrictEqual(before)
    expect((await listTags()).map((t) => t.name).sort()).toEqual(['ラーメン', '寿司', '個室あり', '総曲輪'].sort())
    expect(await getShop((await db.shops.toArray()).find((s) => s.name === '選ばない店')?.id ?? 'none')).toBeUndefined()
  })

  it('one shop: the same name as the shop page; repeated ids count once', async () => {
    const { a, b } = await seedThree()
    const one = await exportShopsCard([a.id], CARD_FILE_TYPE)
    expect(one.fileName).toBe((await exportShopCard(a.id, CARD_FILE_TYPE)).fileName)
    expect(one.fileName).toBe('グルメカード_一番の店.zip')
    const twice = await exportShopsCard([b.id, a.id, b.id, a.id], CARD_FILE_TYPE)
    expect([twice.shopCount, twice.fileName]).toEqual([2, 'グルメカード_二番の店ほか1店.zip'])
    const names = (JSON.parse(await (await openZip(twice.blob)).text(ENTRY.shops)) as { name: string }[]).map((s) => s.name)
    expect(names).toEqual(['二番の店', '一番の店'])
  })

  it('no shop -> ValidationError; an unknown id -> RecordNotFoundError', async () => {
    const { a } = await seedThree()
    await expect(exportShopsCard([], CARD_FILE_TYPE)).rejects.toBeInstanceOf(ValidationError)
    await expect(exportShopsCard([a.id, 'no-such-shop'], CARD_FILE_TYPE)).rejects.toBeInstanceOf(RecordNotFoundError)
  })
})

describe('file name for several shops', () => {
  const at = new Date('2026-09-27T12:05:00.000Z')
  it('ほかN店 after the first name; only the name part is shortened; forbidden characters -> _', () => {
    expect(cardFileName('share', '.zip', at, '白えび亭', 2)).toBe('グルメカード_白えび亭ほか2店.zip')
    expect(cardFileName('share', '.zip', at, 'a/b:c', 11)).toBe('グルメカード_a_b_cほか11店.zip')
    expect(cardFileName('share', '.zip', at, 'あ'.repeat(60), 3)).toBe(`グルメカード_${'あ'.repeat(40)}ほか3店.zip`)
    // unchanged for the existing calls
    expect(cardFileName('share', '.zip', at, '白えび亭')).toBe('グルメカード_白えび亭.zip')
    expect(cardFileName('share', '.zip', at, '白えび亭', 0)).toBe('グルメカード_白えび亭.zip')
    expect(cardFileName('backup', '.zip', at, undefined, 5)).toBe('グルメカード_バックアップ_20260927-2105.zip')
  })
})
