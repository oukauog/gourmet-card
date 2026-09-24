import { newId } from '../lib/id'
import { normalizeTagKey } from '../lib/tagKey'
import { nowIso } from '../lib/time'
import { db } from './db'
import { NotFoundError, TagConflictError, ValidationError } from './errors'
import { tagFieldFor } from './tagFields'
import { TAG_KINDS, type Tag, type TagKind } from './types'

const jaCollator = new Intl.Collator('ja')
const byName = (a: Tag, b: Tag): number => jaCollator.compare(a.name, b.name) || (a.id < b.id ? -1 : 1)

function checkKind(kind: unknown): TagKind {
  if (!TAG_KINDS.includes(kind as TagKind)) throw new ValidationError(`invalid tag kind: ${String(kind)}`)
  return kind as TagKind
}

function keyOf(name: unknown): string {
  if (typeof name !== 'string') throw new ValidationError('tag name must be a string')
  const key = normalizeTagKey(name)
  if (key === '') throw new ValidationError('tag name is required')
  return key
}

function findByKey(kind: TagKind, key: string): Promise<Tag | undefined> {
  return db.tags.where('[kind+normalizedKey]').equals([kind, key]).first()
}

/**
 * Return the tag of this kind whose normalized key matches `name`, or create it.
 * An existing tag keeps its first registered spelling.
 */
export async function findOrCreateTag(kind: TagKind, name: string): Promise<Tag> {
  checkKind(kind)
  const key = keyOf(name)
  return db.transaction('rw', db.tags, async () => {
    const existing = await findByKey(kind, key)
    if (existing) return existing
    const tag: Tag = { id: newId(), kind, name: name.trim(), normalizedKey: key, createdAt: nowIso() }
    await db.tags.add(tag)
    return tag
  })
}

/**
 * Tags of this kind whose normalized key starts with normalizeTagKey(partial), sorted by key.
 * Blank partial returns all tags of the kind. `limit` caps the count (default: no limit).
 */
export async function suggestTags(kind: TagKind, partial: string, limit?: number): Promise<Tag[]> {
  checkKind(kind)
  const key = normalizeTagKey(partial ?? '')
  let collection = db.tags
    .where('[kind+normalizedKey]')
    .between([kind, key], [kind, key + '￿'], true, true)
  if (limit !== undefined) collection = collection.limit(limit)
  return collection.toArray()
}

/**
 * Rename a tag. Throws TagConflictError if another tag of the same kind already has the same
 * normalized key (use mergeTags for that). Changing only case / width of the same tag is allowed.
 */
export async function renameTag(id: string, newName: string): Promise<Tag> {
  const key = keyOf(newName)
  return db.transaction('rw', db.tags, async () => {
    const tag = await db.tags.get(id)
    if (!tag) throw new NotFoundError(`tag not found: ${id}`)
    const other = await findByKey(tag.kind, key)
    if (other && other.id !== id) {
      throw new TagConflictError(`a ${tag.kind} tag with the same name already exists`, other.id)
    }
    tag.name = newName.trim()
    tag.normalizedKey = key
    await db.tags.put(tag)
    return tag
  })
}

/**
 * Merge tag `fromId` into `toId` (same kind only). Every shop that has `from` gets `to` instead
 * (never duplicated), then `from` is deleted. All in one transaction.
 */
export async function mergeTags(fromId: string, toId: string): Promise<void> {
  if (fromId === toId) throw new ValidationError('cannot merge a tag into itself')
  await db.transaction('rw', db.shops, db.tags, async () => {
    const [from, to] = await db.tags.bulkGet([fromId, toId])
    if (!from) throw new NotFoundError(`tag not found: ${fromId}`)
    if (!to) throw new NotFoundError(`tag not found: ${toId}`)
    if (from.kind !== to.kind) throw new ValidationError('can only merge tags of the same kind')
    const field = tagFieldFor(from.kind)
    const now = nowIso()
    await db.shops
      .where(field)
      .equals(fromId)
      .modify((shop) => {
        const replaced = shop[field].map((id) => (id === fromId ? toId : id))
        shop[field] = [...new Set(replaced)]
        shop.updatedAt = now
      })
    await db.tags.delete(fromId)
  })
}

/** Remove the tag from every shop, then delete it. Returns false if it did not exist. */
export async function deleteTag(id: string): Promise<boolean> {
  return db.transaction('rw', db.shops, db.tags, async () => {
    const tag = await db.tags.get(id)
    if (!tag) return false
    const field = tagFieldFor(tag.kind)
    const now = nowIso()
    await db.shops
      .where(field)
      .equals(id)
      .modify((shop) => {
        shop[field] = shop[field].filter((t) => t !== id)
        shop.updatedAt = now
      })
    await db.tags.delete(id)
    return true
  })
}

/** All tags (or of one kind), sorted by display name (ja). */
export async function listTags(kind?: TagKind): Promise<Tag[]> {
  const tags = kind === undefined ? await db.tags.toArray() : await db.tags.where('kind').equals(checkKind(kind)).toArray()
  return tags.sort(byName)
}

async function changeShopTag(shopId: string, tagId: string, attach: boolean): Promise<void> {
  await db.transaction('rw', db.shops, db.tags, async () => {
    const [shop, tag] = await Promise.all([db.shops.get(shopId), db.tags.get(tagId)])
    if (!shop) throw new NotFoundError(`shop not found: ${shopId}`)
    if (!tag) throw new NotFoundError(`tag not found: ${tagId}`)
    const field = tagFieldFor(tag.kind)
    const has = shop[field].includes(tagId)
    if (attach === has) return
    shop[field] = attach ? [...shop[field], tagId] : shop[field].filter((t) => t !== tagId)
    shop.updatedAt = nowIso()
    await db.shops.put(shop)
  })
}

/** Add the tag to the shop's array for its kind (no duplicates). */
export function attachTag(shopId: string, tagId: string): Promise<void> {
  return changeShopTag(shopId, tagId, true)
}

/** Remove the tag from the shop. No-op if not attached. */
export function detachTag(shopId: string, tagId: string): Promise<void> {
  return changeShopTag(shopId, tagId, false)
}
