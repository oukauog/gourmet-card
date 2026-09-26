import { beforeEach, describe, expect, it } from 'vitest'
import { seedUseTags } from './seedUseTags'
import { getSetting } from './settings'
import { deleteTag, findOrCreateTag, listTags } from './tags'
import { resetDbAndClock } from './testHelpers'

const useNames = async () => (await listTags('use')).map((t) => t.name).sort()

describe('seedUseTags', () => {
  beforeEach(resetDbAndClock)

  it('creates 個室あり and 駐車場あり once and records the time', async () => {
    expect(await seedUseTags()).toBe(true)
    expect(await useNames()).toEqual(['個室あり', '駐車場あり'].sort())
    expect(await getSetting('useTagsSeededAt')).toMatch(/^\d{4}-\d\d-\d\dT/)
  })

  it('the second call does nothing', async () => {
    await seedUseTags()
    const ids = (await listTags()).map((t) => t.id)
    const at = await getSetting('useTagsSeededAt')
    expect(await seedUseTags()).toBe(false)
    expect((await listTags()).map((t) => t.id)).toEqual(ids)
    expect(await getSetting('useTagsSeededAt')).toBe(at)
  })

  it('a deleted initial tag does not come back', async () => {
    await seedUseTags()
    const parking = (await listTags('use')).find((t) => t.name === '駐車場あり')!
    await deleteTag(parking.id)
    await seedUseTags()
    expect(await useNames()).toEqual(['個室あり'])
  })

  it('merges with an existing 個室あり (no duplicate)', async () => {
    const own = await findOrCreateTag('use', '個室あり')
    await seedUseTags()
    const tags = await listTags('use')
    expect(tags).toHaveLength(2)
    expect(tags.find((t) => t.name === '個室あり')!.id).toBe(own.id)
  })

  it('does not touch genre / area tags', async () => {
    await findOrCreateTag('genre', '個室あり')
    await seedUseTags()
    expect((await listTags('genre')).map((t) => t.name)).toEqual(['個室あり'])
    expect(await listTags('use')).toHaveLength(2)
  })
})
