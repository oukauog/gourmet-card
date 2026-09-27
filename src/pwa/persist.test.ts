// Asking to keep the data (construction 9a): what is recorded, and "once per run".
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { getSetting, setSetting } from '../db/settings'
import { ValidationError } from '../db/errors'
import { resetDbAndClock } from '../db/testHelpers'
import { PERSIST_RESULT_TEXT, jstMonthDayTime, persistRecordLine } from '../lib/persistText'
import { canRequestPersist, requestPersist, requestPersistOncePerRun, resetPersistRunForTests } from './persist'

/** A fake navigator.storage: persisted() gives `persisted`; persist() gives / throws per `mode`. */
function fakeStorage(mode: 'granted' | 'denied' | 'throw', persisted = false) {
  const storage = {
    persisted: vi.fn(async () => persisted),
    persist: vi.fn(async () => {
      if (mode === 'throw') throw new Error('no')
      return mode === 'granted'
    }),
  }
  vi.stubGlobal('navigator', { storage })
  return storage
}

describe('requestPersist: records when and what', () => {
  beforeEach(async () => {
    await resetDbAndClock()
    resetPersistRunForTests()
  })
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('true -> granted, false -> denied, an exception -> error; the time is recorded each time', async () => {
    fakeStorage('granted')
    expect(await requestPersist()).toBe('granted')
    expect([await getSetting('persistResult'), await getSetting('persistRequestedAt')]).toEqual(['granted', '2026-01-01T00:00:00.000Z'])
    fakeStorage('denied')
    expect(await requestPersist()).toBe('denied')
    expect([await getSetting('persistResult'), await getSetting('persistRequestedAt')]).toEqual(['denied', '2026-01-01T00:00:01.000Z'])
    fakeStorage('throw')
    expect(await requestPersist()).toBe('error')
    expect(await getSetting('persistResult')).toBe('error')
  })

  it('already persisted: persist() is not called and nothing is recorded', async () => {
    const s = fakeStorage('granted', true)
    expect(await requestPersist()).toBeUndefined()
    expect(s.persist).not.toHaveBeenCalled()
    expect([await getSetting('persistResult'), await getSetting('persistRequestedAt')]).toEqual([undefined, undefined])
  })

  it('no API: not called, nothing recorded, the button is not offered', async () => {
    vi.stubGlobal('navigator', {})
    expect(canRequestPersist()).toBe(false)
    expect(await requestPersist()).toBeUndefined()
    vi.stubGlobal('navigator', { storage: { persisted: async () => false } }) // persist missing
    expect(canRequestPersist()).toBe(false)
    expect(await requestPersist()).toBeUndefined()
    expect(await getSetting('persistResult')).toBeUndefined()
    fakeStorage('denied')
    expect(canRequestPersist()).toBe(true)
  })

  it('once per run: not with 0 shops; the first call with a shop asks, later ones do not', async () => {
    const s = fakeStorage('denied')
    expect(await requestPersistOncePerRun(0)).toBeUndefined() // first launch: no shop
    expect(s.persist).not.toHaveBeenCalled()
    expect(await requestPersistOncePerRun(1)).toBe('denied') // the list after the first shop
    expect(await requestPersistOncePerRun(1)).toBeUndefined()
    expect(await requestPersistOncePerRun(5)).toBeUndefined()
    expect(s.persist).toHaveBeenCalledTimes(1)
    // the button still asks (not limited per run)
    expect(await requestPersist()).toBe('denied')
    expect(s.persist).toHaveBeenCalledTimes(2)
  })

  it('the two new settings only take their values', async () => {
    await expect(setSetting('persistResult', 'maybe' as 'granted')).rejects.toBeInstanceOf(ValidationError)
    await expect(setSetting('persistRequestedAt', 'not a date')).rejects.toBeInstanceOf(ValidationError)
    await setSetting('persistResult', 'error')
    expect(await getSetting('persistResult')).toBe('error')
  })
})

describe('the line on the data screen', () => {
  it('Japan time "9月28日 10:12" and the three results', () => {
    expect(jstMonthDayTime('2026-09-28T01:12:00.000Z')).toBe('9月28日 10:12')
    expect(jstMonthDayTime('2026-12-31T15:05:00.000Z')).toBe('1月1日 0:05')
    expect(PERSIST_RESULT_TEXT).toEqual({ granted: '許可されました', denied: '許可されませんでした', error: '失敗しました' })
    expect(persistRecordLine('2026-09-28T01:12:00.000Z', 'denied')).toBe('最後に保護を求めた日時：9月28日 10:12・許可されませんでした')
    expect(persistRecordLine('2026-09-28T01:12:00.000Z', 'granted')).toBe('最後に保護を求めた日時：9月28日 10:12・許可されました')
    expect(persistRecordLine('2026-09-28T01:12:00.000Z', 'error')).toBe('最後に保護を求めた日時：9月28日 10:12・失敗しました')
  })

  it('never asked: no line', () => {
    expect(persistRecordLine(undefined, undefined)).toBeUndefined()
    expect(persistRecordLine('2026-09-28T01:12:00.000Z', undefined)).toBeUndefined()
  })
})
