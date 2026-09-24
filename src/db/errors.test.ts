import { beforeEach, describe, expect, it } from 'vitest'
import { db } from './db'
import { PhotoLimitError, RecordNotFoundError, TagConflictError, ValidationError } from './errors'
import { resetDbAndClock } from './testHelpers'

// Regression: an error class named "NotFoundError" was replaced by Dexie's own DexieError
// when thrown inside db.transaction() (Dexie maps DOMException names). Our error classes
// must keep their class and message across a transaction.
describe('data layer errors survive db.transaction()', () => {
  beforeEach(resetDbAndClock)

  const cases = [
    () => new ValidationError('v'),
    () => new RecordNotFoundError('n'),
    () => new PhotoLimitError('p'),
    () => new TagConflictError('t', 'id-1'),
  ]

  it.each(cases.map((make) => [make().name, make] as const))('%s keeps its class', async (_name, make) => {
    const expected = make()
    const err = await db
      .transaction('rw', db.shops, async () => {
        throw make()
      })
      .catch((e: unknown) => e)
    expect(err).toBeInstanceOf(expected.constructor)
    expect((err as Error).name).toBe(expected.name)
    expect((err as Error).message).toBe(expected.message)
  })
})
