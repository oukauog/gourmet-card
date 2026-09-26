// Data types (spec 3.2 - 3.6). All timestamps are ISO 8601 UTC strings
// (e.g. 2026-09-24T01:23:45.678Z) so that export files stay human readable.

export type IsoDateString = string

export type ShopStatus = 'visited' | 'wishlist'
export type ShopOrigin = 'self' | 'shared'
export type TagKind = 'area' | 'genre' | 'use'
export type SortOrder = 'newest' | 'rating' | 'name'

export const SHOP_STATUSES: readonly ShopStatus[] = ['visited', 'wishlist']
export const SHOP_ORIGINS: readonly ShopOrigin[] = ['self', 'shared']
export const TAG_KINDS: readonly TagKind[] = ['area', 'genre', 'use']
export const SORT_ORDERS: readonly SortOrder[] = ['newest', 'rating', 'name']

export const MAX_PHOTOS_PER_SHOP = 3

export interface Shop {
  id: string
  /** Required. Stored trimmed; never empty. */
  name: string
  status: ShopStatus
  /** Max 3. The first one is the cover. This array is the source of truth for order. */
  photoIds: string[]
  /** Integer 1..50 (3.7 -> 37). Undefined = not rated. */
  rating?: number
  prefecture?: string
  city?: string
  stationId?: string
  areaTagIds: string[]
  genreTagIds: string[]
  useTagIds: string[]
  mapUrl?: string
  memo?: string
  origin: ShopOrigin
  createdAt: IsoDateString
  updatedAt: IsoDateString
}

export interface Photo {
  id: string
  shopId: string
  /** For the list (long side about 400px). */
  small: Blob
  /** For the shop page (long side about 1600-2000px). */
  large: Blob
  /** Size of the large image. */
  width: number
  height: number
  createdAt: IsoDateString
}

export interface Tag {
  id: string
  kind: TagKind
  /** Display name (the first spelling registered is kept). */
  name: string
  /** normalizeTagKey(name). Unique per kind. */
  normalizedKey: string
  createdAt: IsoDateString
}

/** Setting keys and their value types. */
export interface SettingsMap {
  lastBackupAt: IsoDateString
  sortOrder: SortOrder
  columns: 2 | 3
  /** When the initial use tags were created (construction 5; never re-created after that). */
  useTagsSeededAt: IsoDateString
}

export type SettingKey = keyof SettingsMap

export interface Setting<K extends SettingKey = SettingKey> {
  key: K
  value: SettingsMap[K]
}

/** Optional fields that can be set on create / update. */
export interface ShopEditableFields {
  name: string
  status: ShopStatus
  rating: number | undefined
  prefecture: string | undefined
  city: string | undefined
  stationId: string | undefined
  areaTagIds: string[]
  genreTagIds: string[]
  useTagIds: string[]
  mapUrl: string | undefined
  memo: string | undefined
  origin: ShopOrigin
}

/** Input for createShop. Only name is required. */
export type ShopInput = Partial<ShopEditableFields> & { name: string }

/** Patch for updateShop. id / createdAt / updatedAt / photoIds cannot be changed here. */
export type ShopPatch = Partial<ShopEditableFields>

export interface PhotoInput {
  small: Blob
  large: Blob
  width: number
  height: number
}
