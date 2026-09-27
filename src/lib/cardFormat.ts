// The card file (spec 5, format version 1): types, manifest, checks and file names. Pure.
//   manifest.json  shops.json  tags.json  photos.json  photos/<id>-large.jpg  photos/<id>-small.jpg
import { MAX_PHOTOS_PER_SHOP, SHOP_ORIGINS, SHOP_STATUSES, TAG_KINDS, type Photo, type Shop, type Tag } from '../db/types'
import { isValidRating } from './rating'
import { normalizeTagKey } from './tagKey'

export const CARD_FORMAT = 'gourmet-card'
export const CARD_FORMAT_VERSION = 1

export type CardKind = 'share' | 'backup'

export interface CardManifest {
  format: typeof CARD_FORMAT
  formatVersion: number
  kind: CardKind
  /** ISO 8601 UTC. */
  exportedAt: string
  /** Build of the app that wrote the file (commit hash, or "開発版"). */
  appVersion: string
  shopCount: number
  photoCount: number
}

/** A photo without its images (photos.json). */
export type CardPhotoMeta = Pick<Photo, 'id' | 'shopId' | 'width' | 'height' | 'createdAt'>

export const ENTRY = {
  manifest: 'manifest.json',
  shops: 'shops.json',
  tags: 'tags.json',
  photos: 'photos.json',
  large: (photoId: string) => `photos/${photoId}-large.jpg`,
  small: (photoId: string) => `photos/${photoId}-small.jpg`,
} as const

/** Photo ids go into entry names, which must be ASCII (ids are UUIDs; anything else is skipped). */
export const isSafePhotoId = (id: string) => /^[A-Za-z0-9_-]{1,100}$/.test(id)

// ---------- errors ----------

export type CardFileErrorCode = 'not-card' | 'too-new' | 'broken'

const MESSAGES: Record<CardFileErrorCode, string> = {
  'not-card': 'グルメカードのファイルではありません',
  'too-new': '新しい版のアプリで作られたファイルです。アプリを新しくしてから取り込んでください',
  broken: 'ファイルが壊れているため読めませんでした',
}

/** The file cannot be imported at all. `userMessage` is for the screen. */
export class CardFileError extends Error {
  readonly code: CardFileErrorCode
  readonly userMessage: string
  constructor(code: CardFileErrorCode, detail?: string) {
    super(detail ? `${code}: ${detail}` : code)
    this.name = 'CardFileError'
    this.code = code
    this.userMessage = MESSAGES[code]
  }
}

// ---------- manifest ----------

export function buildManifest(kind: CardKind, exportedAt: string, appVersion: string, shopCount: number, photoCount: number): CardManifest {
  return { format: CARD_FORMAT, formatVersion: CARD_FORMAT_VERSION, kind, exportedAt, appVersion, shopCount, photoCount }
}

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)

/** manifest.json text -> manifest. Wrong format: 'not-card'; newer version: 'too-new'. */
export function parseManifest(text: string): CardManifest {
  let v: unknown
  try {
    v = JSON.parse(text)
  } catch {
    throw new CardFileError('not-card', 'manifest is not JSON')
  }
  if (!isObject(v) || v.format !== CARD_FORMAT) throw new CardFileError('not-card', 'format')
  const version = v.formatVersion
  if (typeof version !== 'number' || !Number.isInteger(version) || version < 1) throw new CardFileError('not-card', 'formatVersion')
  if (version > CARD_FORMAT_VERSION) throw new CardFileError('too-new', `formatVersion ${version}`)
  if (v.kind !== 'share' && v.kind !== 'backup') throw new CardFileError('not-card', 'kind')
  const count = (x: unknown) => (typeof x === 'number' && Number.isInteger(x) && x >= 0 ? x : 0)
  return {
    format: CARD_FORMAT,
    formatVersion: version,
    kind: v.kind,
    exportedAt: normalizeIso(v.exportedAt) ?? '',
    appVersion: typeof v.appVersion === 'string' ? v.appVersion : '',
    shopCount: count(v.shopCount),
    photoCount: count(v.photoCount),
  }
}

/** A JSON array entry (shops.json etc.); anything else is a broken file. */
export function parseJsonArray(text: string, what: string): unknown[] {
  let v: unknown
  try {
    v = JSON.parse(text)
  } catch {
    throw new CardFileError('broken', `${what} is not JSON`)
  }
  if (!Array.isArray(v)) throw new CardFileError('broken', `${what} is not an array`)
  return v
}

// ---------- records ----------

/** Any date string Date.parse understands -> ISO 8601 UTC (spec 3.7). Otherwise undefined. */
export function normalizeIso(v: unknown): string | undefined {
  if (typeof v !== 'string' || v.trim() === '') return undefined
  const t = Date.parse(v)
  return Number.isNaN(t) ? undefined : new Date(t).toISOString()
}

const isId = (v: unknown): v is string => typeof v === 'string' && v.trim() !== '' && v.length <= 200
const stringArray = (v: unknown): string[] | undefined =>
  Array.isArray(v) && v.every((x) => typeof x === 'string') ? [...new Set(v as string[])] : undefined

const OPTIONAL_STRINGS = ['prefecture', 'city', 'stationId', 'mapUrl', 'memo'] as const

/**
 * A shop of shops.json, checked and cleaned like the data layer would store it; undefined when
 * it cannot be taken (the caller skips it and counts it). Unknown keys are dropped; blank
 * optional strings are "not set"; dates become ISO strings.
 */
export function readShop(v: unknown): Shop | undefined {
  if (!isObject(v) || !isId(v.id)) return undefined
  if (typeof v.name !== 'string' || v.name.trim() === '') return undefined
  if (!SHOP_STATUSES.includes(v.status as Shop['status'])) return undefined
  if (!SHOP_ORIGINS.includes(v.origin as Shop['origin'])) return undefined
  if (v.rating !== undefined && !isValidRating(v.rating)) return undefined
  const photoIds = stringArray(v.photoIds)
  const areaTagIds = stringArray(v.areaTagIds)
  const genreTagIds = stringArray(v.genreTagIds)
  const useTagIds = stringArray(v.useTagIds)
  if (!photoIds || photoIds.length > MAX_PHOTOS_PER_SHOP || !areaTagIds || !genreTagIds || !useTagIds) return undefined
  const createdAt = normalizeIso(v.createdAt)
  const updatedAt = normalizeIso(v.updatedAt)
  if (!createdAt || !updatedAt) return undefined

  const shop: Shop = {
    id: v.id,
    name: v.name.trim(),
    status: v.status as Shop['status'],
    photoIds,
    areaTagIds,
    genreTagIds,
    useTagIds,
    origin: v.origin as Shop['origin'],
    createdAt,
    updatedAt,
  }
  if (v.rating !== undefined) shop.rating = v.rating as number
  for (const key of OPTIONAL_STRINGS) {
    const s = v[key]
    if (s === undefined) continue
    if (typeof s !== 'string') return undefined
    if (s.trim() !== '') shop[key] = s
  }
  return shop
}

/** A tag of tags.json (normalizedKey is recomputed from the name); undefined when unusable. */
export function readTag(v: unknown): Tag | undefined {
  if (!isObject(v) || !isId(v.id) || !TAG_KINDS.includes(v.kind as Tag['kind'])) return undefined
  if (typeof v.name !== 'string') return undefined
  const key = normalizeTagKey(v.name)
  const createdAt = normalizeIso(v.createdAt)
  if (key === '' || !createdAt) return undefined
  return { id: v.id, kind: v.kind as Tag['kind'], name: v.name.trim(), normalizedKey: key, createdAt }
}

/** A photo of photos.json; undefined when unusable. */
export function readPhotoMeta(v: unknown): CardPhotoMeta | undefined {
  if (!isObject(v) || !isId(v.id) || !isSafePhotoId(v.id) || !isId(v.shopId)) return undefined
  const size = (x: unknown) => typeof x === 'number' && Number.isInteger(x) && x > 0
  if (!size(v.width) || !size(v.height)) return undefined
  const createdAt = normalizeIso(v.createdAt)
  if (!createdAt) return undefined
  return { id: v.id, shopId: v.shopId, width: v.width as number, height: v.height as number, createdAt }
}

/** A stored shop without the keys that are undefined (JSON would drop them anyway). */
export function shopForFile(shop: Shop): Shop {
  return Object.fromEntries(Object.entries(shop).filter(([, v]) => v !== undefined)) as unknown as Shop
}

// ---------- file names ----------

const JST = 9 * 60 * 60 * 1000
const pad = (n: number) => String(n).padStart(2, '0')

/** "20260927-2105" in Japan time (UTC+9). */
export function jstStamp(d: Date): string {
  const j = new Date(d.getTime() + JST)
  return `${j.getUTCFullYear()}${pad(j.getUTCMonth() + 1)}${pad(j.getUTCDate())}-${pad(j.getUTCHours())}${pad(j.getUTCMinutes())}`
}

export const SHOP_NAME_MAX = 40

/** A shop name usable in a file name: \ / : * ? " < > | and line breaks -> "_", at most 40 characters. */
export function fileNamePart(name: string): string {
  // control characters (line breaks included) and \ / : * ? " < > | become "_"
  const cleaned = [...name]
    .map((c) => (c.charCodeAt(0) < 0x20 || c === '\u007f' || '\\/:*?"<>|'.includes(c) ? '_' : c))
    .join('')
    .trim()
  const chars = [...cleaned] // code points: never cut a surrogate pair
  const cut = chars.length > SHOP_NAME_MAX ? chars.slice(0, SHOP_NAME_MAX).join('') : cleaned
  return cut.replace(/^\.+/, '_') || '_'
}

/**
 * グルメカード_<店名><ext> / グルメカード_バックアップ_YYYYMMDD-HHmm<ext>.
 * Several shops (construction 8b): グルメカード_<first shop's name>ほかN店<ext> (N = the other
 * shops); only the name part is shortened, "ほかN店" is never cut.
 */
export function cardFileName(kind: CardKind, extension: string, at: Date, shopName?: string, otherShops = 0): string {
  if (kind === 'backup') return `グルメカード_バックアップ_${jstStamp(at)}${extension}`
  const others = otherShops > 0 ? `ほか${otherShops}店` : ''
  return `グルメカード_${fileNamePart(shopName ?? '')}${others}${extension}`
}
