// Test-only helpers (imported only from *.test.ts; never from app code).
import { setClock } from '../lib/time'
import { db } from './db'

export const TEST_EPOCH = Date.parse('2026-01-01T00:00:00.000Z')

/**
 * Start every test from an empty database and a deterministic clock that
 * advances 1 second on every nowIso() call (so createdAt values are distinct).
 */
export async function resetDbAndClock(): Promise<void> {
  db.close()
  await db.delete()
  await db.open()
  let t = TEST_EPOCH
  setClock(() => {
    const iso = new Date(t).toISOString()
    t += 1000
    return iso
  })
}

export function blobOf(bytes: number[], type = 'image/jpeg'): Blob {
  return new Blob([new Uint8Array(bytes)], { type })
}

export async function bytesOf(blob: Blob): Promise<number[]> {
  return [...new Uint8Array(await blob.arrayBuffer())]
}
