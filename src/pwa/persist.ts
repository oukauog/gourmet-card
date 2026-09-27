// Ask the browser to keep this app's data (construction 9, spec 4.6): once at start, when there is
// at least one shop and the storage is not persisted yet. Any failure is silent.
import { countShops } from '../db/shops'

export async function requestPersistOnce(): Promise<void> {
  try {
    const storage = navigator.storage
    if (!storage?.persisted || !storage.persist) return
    if ((await countShops()) === 0) return
    if (await storage.persisted()) return
    await storage.persist()
  } catch {
    // not supported / refused: nothing to show
  }
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
