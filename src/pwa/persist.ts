// Ask the browser to keep this app's data (construction 9 / 9a, spec 4.6).
// When: (1) at start, (2) when the list is shown - both only with at least one shop, and at most
// once per run together (the first launch has no shop, so the list catches the first one), and
// (3) the "保護を求める" button (any time, even with no shop).
// Every call of navigator.storage.persist() is recorded (persistRequestedAt / persistResult), so a
// refusal can be told from "never asked". Not asked (nor recorded) when already persisted or when
// the API is missing. Nothing is shown on failure except that record.
import { setSetting } from '../db/settings'
import { countShops } from '../db/shops'
import type { PersistResult } from '../db/types'
import { nowIso } from '../lib/time'

function storageApi(): StorageManager | undefined {
  const s = typeof navigator === 'undefined' ? undefined : navigator.storage
  return s && typeof s.persist === 'function' && typeof s.persisted === 'function' ? s : undefined
}

/** True when the browser has persist() / persisted() (the button is only shown then). */
export const canRequestPersist = (): boolean => storageApi() !== undefined

/**
 * Call persist() once and record when and what came back (granted / denied / error). Returns the
 * result, or undefined when it was not called (no API, or already persisted).
 */
export async function requestPersist(): Promise<PersistResult | undefined> {
  const storage = storageApi()
  if (!storage) return undefined
  try {
    if (await storage.persisted()) return undefined
  } catch {
    // cannot tell: ask anyway
  }
  let result: PersistResult
  try {
    result = (await storage.persist()) ? 'granted' : 'denied'
  } catch {
    result = 'error'
  }
  try {
    await setSetting('persistRequestedAt', nowIso())
    await setSetting('persistResult', result)
  } catch {
    // the record is only for the data screen
  }
  return result
}

// once per run for (1) and (2) together; module state = until the app is closed / reloaded
let askedThisRun = false

/** (1) / (2): ask when there is a shop, at most once per run. Checked and set synchronously. */
export function requestPersistOncePerRun(shopCount: number): Promise<PersistResult | undefined> {
  if (askedThisRun || shopCount <= 0) return Promise.resolve(undefined)
  askedThisRun = true
  return requestPersist()
}

/** (1) at start (App.tsx). */
export async function requestPersistOnce(): Promise<void> {
  try {
    await requestPersistOncePerRun(await countShops())
  } catch {
    // nothing to show
  }
}

/** Tests only: forget "asked in this run". */
export function resetPersistRunForTests(): void {
  askedThisRun = false
}

export interface StorageState {
  /** undefined when the browser cannot tell. */
  persisted?: boolean
  /** Bytes used (estimate), undefined when unknown. */
  usage?: number
}

export async function readStorageState(): Promise<StorageState> {
  const s: StorageState = {}
  try {
    if (navigator.storage?.persisted) s.persisted = await navigator.storage.persisted()
  } catch {
    // unknown
  }
  try {
    if (navigator.storage?.estimate) s.usage = (await navigator.storage.estimate()).usage
  } catch {
    // unknown
  }
  return s
}
