import { beforeEach, describe, expect, it } from 'vitest'
import { createDb, db, DB_NAME } from './db'
import { blobOf, bytesOf, resetDbAndClock } from './testHelpers'

describe('GourmetDB schema', () => {
  beforeEach(resetDbAndClock)

  it('uses the app DB name and has the 4 tables', async () => {
    expect(db.name).toBe(DB_NAME)
    expect(db.verno).toBe(1)
    expect(db.tables.map((t) => t.name).sort()).toEqual(['photos', 'settings', 'shops', 'tags'])
  })

  it('createDb(name) gives an independent database', async () => {
    const other = createDb('gourmet-card-test-other')
    try {
      await other.settings.put({ key: 'columns', value: 3 })
      expect(await db.settings.get('columns')).toBeUndefined()
      expect((await other.settings.get('columns'))?.value).toBe(3)
    } finally {
      other.close()
      await other.delete()
    }
  })

  it('enforces unique [kind+normalizedKey] on tags', async () => {
    const base = { kind: 'genre' as const, name: 'ラーメン', normalizedKey: 'ラーメン', createdAt: 'x' }
    await db.tags.add({ id: 't1', ...base })
    await expect(db.tags.add({ id: 't2', ...base, name: 'ﾗｰﾒﾝ' })).rejects.toMatchObject({
      name: 'ConstraintError',
    })
    // Same key in a different kind is allowed.
    await db.tags.add({ id: 't3', ...base, kind: 'area' })
    expect(await db.tags.count()).toBe(2)
  })

  it('stores Blobs and reads back identical bytes', async () => {
    const small = blobOf([0, 1, 2, 3, 254, 255])
    const large = blobOf(Array.from({ length: 4096 }, (_, i) => (i * 7) % 256))
    await db.photos.put({ id: 'p1', shopId: 's1', small, large, width: 1600, height: 1200, createdAt: 'x' })
    const back = await db.photos.get('p1')
    expect(back?.small).toBeInstanceOf(Blob)
    expect(back?.large).toBeInstanceOf(Blob)
    expect(back?.small.type).toBe('image/jpeg')
    expect(back?.large.size).toBe(4096)
    expect(await bytesOf(back!.small)).toEqual(await bytesOf(small))
    expect(await bytesOf(back!.large)).toEqual(await bytesOf(large))
  })
})
