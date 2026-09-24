import { newId } from '../lib/id'
import { isValidRating } from '../lib/rating'
import { nowIso } from '../lib/time'
import { db } from './db'
import { NotFoundError, ValidationError } from './errors'
import { TAG_FIELDS } from './tagFields'
import {
  SHOP_ORIGINS,
  SHOP_STATUSES,
  type Shop,
  type ShopInput,
  type ShopPatch,
  type ShopStatus,
  type SortOrder,
  type TagKind,
} from './types'

const IMMUTABLE_KEYS = ['id', 'createdAt', 'updatedAt', 'photoIds'] as const
const OPTIONAL_STRING_KEYS = ['prefecture', 'city', 'stationId', 'mapUrl', 'memo'] as const

const jaCollator = new Intl.Collator('ja')

function has<T extends object>(obj: T, key: PropertyKey): boolean {
  return Object.prototype.hasOwnProperty.call(obj, key)
}

function cleanName(name: unknown): string {
  if (typeof name !== 'string') throw new ValidationError('name must be a string')
  const trimmed = name.trim()
  if (trimmed === '') throw new ValidationError('name is required')
  return trimmed
}

/** Blank (empty or whitespace only) optional strings are stored as "not set". */
function cleanOptionalString(key: string, value: unknown): string | undefined {
  if (value === undefined) return undefined
  if (typeof value !== 'string') throw new ValidationError(`${key} must be a string`)
  return value.trim() === '' ? undefined : value
}

function checkRating(value: unknown): number | undefined {
  if (value === undefined) return undefined
  if (!isValidRating(value)) throw new ValidationError(`rating must be an integer 1..50: ${String(value)}`)
  return value
}

function checkOneOf<T extends string>(key: string, value: unknown, allowed: readonly T[]): T {
  if (!allowed.includes(value as T)) throw new ValidationError(`invalid ${key}: ${String(value)}`)
  return value as T
}

/** Dedupe (keeping order) and check that every id is an existing tag of the kind. */
async function cleanTagIds(kind: TagKind, value: unknown): Promise<string[]> {
  if (!Array.isArray(value) || value.some((v) => typeof v !== 'string')) {
    throw new ValidationError(`${kind} tag ids must be an array of strings`)
  }
  const ids = [...new Set(value as string[])]
  const tags = await db.tags.bulkGet(ids)
  tags.forEach((tag, i) => {
    if (!tag) throw new NotFoundError(`tag not found: ${ids[i]}`)
    if (tag.kind !== kind) throw new ValidationError(`tag ${ids[i]} is not a ${kind} tag`)
  })
  return ids
}

/** Apply the given fields (only keys present in `fields`) onto `shop`. */
async function applyFields(shop: Shop, fields: ShopPatch): Promise<void> {
  if (has(fields, 'name')) shop.name = cleanName(fields.name)
  if (has(fields, 'status')) shop.status = checkOneOf('status', fields.status, SHOP_STATUSES)
  if (has(fields, 'origin')) shop.origin = checkOneOf('origin', fields.origin, SHOP_ORIGINS)
  if (has(fields, 'rating')) {
    const rating = checkRating(fields.rating)
    if (rating === undefined) delete shop.rating
    else shop.rating = rating
  }
  for (const key of OPTIONAL_STRING_KEYS) {
    if (!has(fields, key)) continue
    const value = cleanOptionalString(key, fields[key])
    if (value === undefined) delete shop[key]
    else shop[key] = value
  }
  for (const { kind, field } of TAG_FIELDS) {
    if (has(fields, field)) shop[field] = await cleanTagIds(kind, fields[field])
  }
}

/**
 * Create a shop. Only name is required (trimmed, must not be blank).
 * Defaults: status 'visited', origin 'self', empty arrays, createdAt = updatedAt = now.
 */
export async function createShop(input: ShopInput): Promise<Shop> {
  const now = nowIso()
  const shop: Shop = {
    id: newId(),
    name: cleanName(input?.name),
    status: 'visited',
    photoIds: [],
    areaTagIds: [],
    genreTagIds: [],
    useTagIds: [],
    origin: 'self',
    createdAt: now,
    updatedAt: now,
  }
  return db.transaction('rw', db.shops, db.tags, async () => {
    await applyFields(shop, input)
    await db.shops.add(shop)
    return shop
  })
}

export async function getShop(id: string): Promise<Shop | undefined> {
  return db.shops.get(id)
}

/**
 * Update a shop. Only keys present in `patch` are changed; `undefined` clears an optional field.
 * id / createdAt / updatedAt / photoIds cannot be changed (ValidationError). updatedAt is set to now.
 */
export async function updateShop(id: string, patch: ShopPatch): Promise<Shop> {
  for (const key of IMMUTABLE_KEYS) {
    if (has(patch, key)) throw new ValidationError(`${key} cannot be changed by updateShop`)
  }
  return db.transaction('rw', db.shops, db.tags, async () => {
    const shop = await db.shops.get(id)
    if (!shop) throw new NotFoundError(`shop not found: ${id}`)
    await applyFields(shop, patch)
    shop.updatedAt = nowIso()
    await db.shops.put(shop)
    return shop
  })
}

/** Delete a shop and its photos in one transaction. No-op if it does not exist. */
export async function deleteShop(id: string): Promise<void> {
  await db.transaction('rw', db.shops, db.photos, async () => {
    await db.photos.where('shopId').equals(id).delete()
    await db.shops.delete(id)
  })
}

export interface ListShopsOptions {
  status?: ShopStatus
  /** Default 'newest'. */
  sort?: SortOrder
}

const byNewest = (a: Shop, b: Shop): number =>
  a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : a.id < b.id ? -1 : a.id > b.id ? 1 : 0

const COMPARATORS: Record<SortOrder, (a: Shop, b: Shop) => number> = {
  newest: byNewest,
  // Higher rating first, unrated last; ties by newest.
  rating: (a, b) => (b.rating ?? 0) - (a.rating ?? 0) || byNewest(a, b),
  // Japanese locale ascending; ties by newest.
  name: (a, b) => jaCollator.compare(a.name, b.name) || byNewest(a, b),
}

/** List shops (all statuses when status is omitted), sorted. */
export async function listShops(options: ListShopsOptions = {}): Promise<Shop[]> {
  const { status, sort = 'newest' } = options
  const shops =
    status === undefined ? await db.shops.toArray() : await db.shops.where('status').equals(status).toArray()
  return shops.sort(COMPARATORS[sort])
}

export async function countShops(status?: ShopStatus): Promise<number> {
  return status === undefined ? db.shops.count() : db.shops.where('status').equals(status).count()
}
