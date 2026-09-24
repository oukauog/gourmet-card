import { beforeEach, describe, expect, it } from 'vitest'
import { db } from './db'
import { RecordNotFoundError, TagConflictError, ValidationError } from './errors'
import { createShop, getShop } from './shops'
import {
  attachTag,
  deleteTag,
  detachTag,
  findOrCreateTag,
  listTags,
  mergeTags,
  renameTag,
  suggestTags,
} from './tags'
import { resetDbAndClock } from './testHelpers'

describe('findOrCreateTag', () => {
  beforeEach(resetDbAndClock)

  it('returns the same tag for spelling variations and keeps the first spelling', async () => {
    const t1 = await findOrCreateTag('genre', 'ラーメン')
    const t2 = await findOrCreateTag('genre', ' ﾗｰﾒﾝ ')
    expect(t2.id).toBe(t1.id)
    expect(t2.name).toBe('ラーメン')
    const b1 = await findOrCreateTag('genre', 'BAR')
    expect((await findOrCreateTag('genre', 'ｂａｒ')).id).toBe(b1.id)
    expect((await findOrCreateTag('genre', 'Bar')).name).toBe('BAR')
    expect(await db.tags.count()).toBe(2)
  })

  it('creates separate tags for the same name in different kinds', async () => {
    const g = await findOrCreateTag('genre', '海鮮')
    const a = await findOrCreateTag('area', '海鮮')
    expect(a.id).not.toBe(g.id)
    expect(a.kind).toBe('area')
  })

  it('treats hiragana and katakana as different tags', async () => {
    const a = await findOrCreateTag('genre', 'ラーメン')
    const b = await findOrCreateTag('genre', 'らーめん')
    expect(a.id).not.toBe(b.id)
  })

  it('rejects blank names and unknown kinds', async () => {
    await expect(findOrCreateTag('genre', '  ')).rejects.toBeInstanceOf(ValidationError)
    await expect(findOrCreateTag('x' as 'genre', 'a')).rejects.toBeInstanceOf(ValidationError)
  })
})

describe('suggestTags / listTags', () => {
  beforeEach(resetDbAndClock)

  it('suggests by normalized prefix within the kind', async () => {
    await findOrCreateTag('genre', 'ラーメン')
    await findOrCreateTag('genre', 'ラム料理')
    await findOrCreateTag('genre', '焼肉')
    await findOrCreateTag('area', 'ラーメン街道')
    expect((await suggestTags('genre', 'ﾗ')).map((t) => t.name)).toEqual(['ラム料理', 'ラーメン'].sort((a, b) => (a < b ? -1 : 1)))
    expect((await suggestTags('genre', 'ラー')).map((t) => t.name)).toEqual(['ラーメン'])
    expect((await suggestTags('genre', 'ラ', 1))).toHaveLength(1)
    expect((await suggestTags('genre', 'すし'))).toEqual([])
    expect((await suggestTags('genre', ''))).toHaveLength(3)
  })

  it('suggests case-insensitively', async () => {
    await findOrCreateTag('use', 'Wi-Fiあり')
    expect((await suggestTags('use', 'WI')).map((t) => t.name)).toEqual(['Wi-Fiあり'])
  })

  it('lists tags by kind, sorted by name', async () => {
    await findOrCreateTag('genre', 'すし')
    await findOrCreateTag('genre', 'かに')
    await findOrCreateTag('area', '八尾')
    expect((await listTags('genre')).map((t) => t.name)).toEqual(['かに', 'すし'])
    expect(await listTags()).toHaveLength(3)
  })
})

describe('renameTag', () => {
  beforeEach(resetDbAndClock)

  it('renames and updates the normalized key', async () => {
    const t = await findOrCreateTag('genre', 'らーめん')
    const renamed = await renameTag(t.id, 'ラーメン')
    expect(renamed.name).toBe('ラーメン')
    expect(renamed.normalizedKey).toBe('ラーメン')
    expect((await findOrCreateTag('genre', 'ﾗｰﾒﾝ')).id).toBe(t.id)
  })

  it('allows changing only case of the same tag', async () => {
    const t = await findOrCreateTag('genre', 'bar')
    expect((await renameTag(t.id, 'BAR')).name).toBe('BAR')
  })

  it('throws TagConflictError when colliding with another tag of the same kind', async () => {
    const a = await findOrCreateTag('genre', 'ラーメン')
    const b = await findOrCreateTag('genre', '中華そば')
    const err = await renameTag(b.id, 'ﾗｰﾒﾝ').catch((e: unknown) => e)
    expect(err).toBeInstanceOf(TagConflictError)
    expect((err as TagConflictError).existingTagId).toBe(a.id)
    expect((await db.tags.get(b.id))?.name).toBe('中華そば')
  })

  it('does not conflict with a tag of another kind', async () => {
    await findOrCreateTag('area', 'ラーメン')
    const g = await findOrCreateTag('genre', '中華そば')
    expect((await renameTag(g.id, 'ラーメン')).name).toBe('ラーメン')
  })

  it('throws for missing tag or blank name', async () => {
    await expect(renameTag('missing', 'x')).rejects.toBeInstanceOf(RecordNotFoundError)
    const t = await findOrCreateTag('genre', 'a')
    await expect(renameTag(t.id, ' ')).rejects.toBeInstanceOf(ValidationError)
  })
})

describe('mergeTags', () => {
  beforeEach(resetDbAndClock)

  it('moves shops to the target tag without duplicates and deletes the source', async () => {
    const from = await findOrCreateTag('genre', 'らーめん')
    const to = await findOrCreateTag('genre', 'ラーメン')
    const other = await findOrCreateTag('genre', '餃子')
    const onlyFrom = await createShop({ name: 'a', genreTagIds: [from.id, other.id] })
    const both = await createShop({ name: 'b', genreTagIds: [to.id, from.id] })
    const onlyTo = await createShop({ name: 'c', genreTagIds: [to.id] })
    const none = await createShop({ name: 'd' })

    await mergeTags(from.id, to.id)

    expect((await getShop(onlyFrom.id))?.genreTagIds).toEqual([to.id, other.id])
    expect((await getShop(both.id))?.genreTagIds).toEqual([to.id])
    expect(await getShop(onlyTo.id)).toEqual(onlyTo) // untouched
    expect(await getShop(none.id)).toEqual(none)
    expect(await db.tags.get(from.id)).toBeUndefined()
    expect(await db.shops.where('genreTagIds').equals(from.id).count()).toBe(0)
  })

  it('rejects different kinds, same tag, and missing tags (nothing changes)', async () => {
    const g = await findOrCreateTag('genre', 'a')
    const a = await findOrCreateTag('area', 'b')
    const shop = await createShop({ name: 's', genreTagIds: [g.id] })
    await expect(mergeTags(g.id, a.id)).rejects.toBeInstanceOf(ValidationError)
    await expect(mergeTags(g.id, g.id)).rejects.toBeInstanceOf(ValidationError)
    await expect(mergeTags(g.id, 'missing')).rejects.toBeInstanceOf(RecordNotFoundError)
    expect(await db.tags.count()).toBe(2)
    expect(await getShop(shop.id)).toEqual(shop)
  })
})

describe('deleteTag', () => {
  beforeEach(resetDbAndClock)

  it('removes the tag from all shops, then deletes it', async () => {
    const t = await findOrCreateTag('area', '総曲輪')
    const keep = await findOrCreateTag('area', '八尾')
    const s1 = await createShop({ name: 'a', areaTagIds: [t.id, keep.id] })
    const s2 = await createShop({ name: 'b', areaTagIds: [t.id] })
    expect(await deleteTag(t.id)).toBe(true)
    expect((await getShop(s1.id))?.areaTagIds).toEqual([keep.id])
    expect((await getShop(s2.id))?.areaTagIds).toEqual([])
    expect(await db.tags.get(t.id)).toBeUndefined()
    expect(await deleteTag(t.id)).toBe(false)
  })
})

describe('attachTag / detachTag', () => {
  beforeEach(resetDbAndClock)

  it('attaches to the array for the tag kind without duplicates', async () => {
    const shop = await createShop({ name: 'a' })
    const g = await findOrCreateTag('genre', '海鮮')
    const u = await findOrCreateTag('use', '個室あり')
    const ar = await findOrCreateTag('area', '国道8号沿い')
    await attachTag(shop.id, g.id)
    await attachTag(shop.id, g.id)
    await attachTag(shop.id, u.id)
    await attachTag(shop.id, ar.id)
    const after = await getShop(shop.id)
    expect(after?.genreTagIds).toEqual([g.id])
    expect(after?.useTagIds).toEqual([u.id])
    expect(after?.areaTagIds).toEqual([ar.id])
    expect(after!.updatedAt > shop.updatedAt).toBe(true)
  })

  it('detaches, and is a no-op when not attached', async () => {
    const g = await findOrCreateTag('genre', '海鮮')
    const shop = await createShop({ name: 'a', genreTagIds: [g.id] })
    await detachTag(shop.id, g.id)
    const after = await getShop(shop.id)
    expect(after?.genreTagIds).toEqual([])
    await detachTag(shop.id, g.id)
    expect(await getShop(shop.id)).toEqual(after) // updatedAt unchanged on no-op
  })

  it('throws for missing shop or tag', async () => {
    const g = await findOrCreateTag('genre', '海鮮')
    const shop = await createShop({ name: 'a' })
    await expect(attachTag('missing', g.id)).rejects.toBeInstanceOf(RecordNotFoundError)
    await expect(attachTag(shop.id, 'missing')).rejects.toBeInstanceOf(RecordNotFoundError)
  })
})
