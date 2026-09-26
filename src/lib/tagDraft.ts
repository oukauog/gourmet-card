// Tags chosen in the form before saving (spec 4.2.1). New tags are NOT created while typing;
// a draft without `id` becomes a tag only when the form is saved (findOrCreateTag).
import { normalizeTagKey } from './tagKey'

export interface TagDraft {
  /** normalizeTagKey(name): identity inside one form (no duplicates). */
  key: string
  /** Display name (the existing tag's spelling when it matches one). */
  name: string
  /** Set when it is an existing tag. */
  id?: string
}

/** Minimal shape of an existing tag. */
export interface KnownTag {
  id: string
  name: string
  normalizedKey: string
}

export function draftFromTag(tag: KnownTag): TagDraft {
  return { key: tag.normalizedKey, name: tag.name, id: tag.id }
}

/**
 * Add a typed name to the end. Blank names and names already in the list (same normalized key)
 * are ignored. If an existing tag has the same normalized key, that tag is used as is.
 */
export function addTagDraft(list: readonly TagDraft[], name: string, known: readonly KnownTag[]): TagDraft[] {
  const key = normalizeTagKey(name)
  if (key === '' || list.some((d) => d.key === key)) return [...list]
  const existing = known.find((t) => t.normalizedKey === key)
  return [...list, existing ? draftFromTag(existing) : { key, name: name.trim() }]
}

export function removeTagDraft(list: readonly TagDraft[], key: string): TagDraft[] {
  return list.filter((d) => d.key !== key)
}

/** Add (at the end) or remove. */
export function toggleTagDraft(list: readonly TagDraft[], draft: TagDraft): TagDraft[] {
  return list.some((d) => d.key === draft.key) ? removeTagDraft(list, draft.key) : [...list, draft]
}

/** Candidates not already in the list. */
export function withoutChosen<T extends KnownTag>(candidates: readonly T[], list: readonly TagDraft[]): T[] {
  const chosen = new Set(list.map((d) => d.key))
  return candidates.filter((t) => !chosen.has(t.normalizedKey))
}
