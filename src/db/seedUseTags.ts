// Initial "使い道" tags (spec 3.4 / 4.2.1). Created ONCE: after that the setting
// useTagsSeededAt is set, so an initial tag the user deleted does not come back.
import { nowIso } from '../lib/time'
import { db } from './db'
import { getSetting, setSetting } from './settings'
import { findOrCreateTag } from './tags'

export const INITIAL_USE_TAGS: readonly string[] = ['個室あり', '駐車場あり']

/** Create the initial use tags if never done. Returns true when it created (or merged) them. */
export async function seedUseTags(): Promise<boolean> {
  return db.transaction('rw', db.tags, db.settings, async () => {
    if (await getSetting('useTagsSeededAt')) return false
    // an existing tag with the same normalized key is reused (no duplicates)
    for (const name of INITIAL_USE_TAGS) await findOrCreateTag('use', name)
    await setSetting('useTagsSeededAt', nowIso())
    return true
  })
}
