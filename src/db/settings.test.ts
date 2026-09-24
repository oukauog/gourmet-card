import { beforeEach, describe, expect, it } from 'vitest'
import { ValidationError } from './errors'
import { getSetting, setSetting } from './settings'
import { resetDbAndClock } from './testHelpers'
import type { SettingKey } from './types'

describe('settings', () => {
  beforeEach(resetDbAndClock)

  it('returns undefined when not set', async () => {
    expect(await getSetting('lastBackupAt')).toBeUndefined()
    expect(await getSetting('sortOrder')).toBeUndefined()
    expect(await getSetting('columns')).toBeUndefined()
  })

  it('stores and reads typed values', async () => {
    await setSetting('lastBackupAt', '2026-09-24T01:23:45.678Z')
    await setSetting('sortOrder', 'rating')
    await setSetting('columns', 3)
    const last: string | undefined = await getSetting('lastBackupAt')
    const sort: 'newest' | 'rating' | 'name' | undefined = await getSetting('sortOrder')
    const cols: 2 | 3 | undefined = await getSetting('columns')
    expect([last, sort, cols]).toEqual(['2026-09-24T01:23:45.678Z', 'rating', 3])
    await setSetting('columns', 2)
    expect(await getSetting('columns')).toBe(2)
  })

  it('rejects wrong values and unknown keys at runtime', async () => {
    await expect(setSetting('columns', 4 as 2)).rejects.toBeInstanceOf(ValidationError)
    await expect(setSetting('sortOrder', 'old' as 'name')).rejects.toBeInstanceOf(ValidationError)
    await expect(setSetting('lastBackupAt', 'not a date')).rejects.toBeInstanceOf(ValidationError)
    await expect(setSetting('nope' as SettingKey, 1 as never)).rejects.toBeInstanceOf(ValidationError)
    expect(await getSetting('columns')).toBeUndefined()
  })
})
