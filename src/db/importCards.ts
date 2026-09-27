// Read a card file and import it (construction 8, spec 4.5.2 / 5). The IMPORT-ONLY save lives
// here: createShop stays the "register my own shop" function (spec 3.7).
//   previewCard(file)  -> what is inside, how many shops are new / already here, what is skipped
//   importCard(preview, { overwrite }) -> saves shop by shop (one transaction each)
// Rules
//   share  : status "wishlist", origin "shared", createdAt = updatedAt = the import time; the rest as is
//   backup : everything as is (id, dates, status, origin)
//   a shop whose id is already here: kept (default) or replaced with its photos (overwrite)
//   tags   : same kind + normalized key as a tag here -> that tag; otherwise created (the file's id
//            when it is free here, else a new id; createdAt kept)
//   photos : the file's id / width / height / createdAt; a new id only if another shop has that id
//   broken shops / unreadable photos are skipped and counted (the import goes on)
import { CardFileError, ENTRY, parseJsonArray, parseManifest, readPhotoMeta, readShop, readTag, type CardKind, type CardPhotoMeta } from '../lib/cardFormat'
import { newId } from '../lib/id'
import { nowIso } from '../lib/time'
import { openZip, ZipCrcError, ZipFormatError, type ZipReader } from '../lib/zipStore'
import { db } from './db'
import { TAG_FIELDS } from './tagFields'
import type { Photo, Shop, Tag } from './types'

export interface CardPreview {
  kind: CardKind
  exportedAt: string
  appVersion: string
  /** Shops that can be imported (checked; photos without images and unknown tag ids removed). */
  shops: Shop[]
  /** Ids of `shops` that are not on this device / already here. */
  newIds: string[]
  existingIds: string[]
  /** Shops of the file that cannot be imported (broken or duplicated). */
  skippedShops: number
  /** Photos that cannot be imported (no image in the file, broken description). */
  skippedPhotos: number
  /** internal */
  tags: Tag[]
  photos: ReadonlyMap<string, CardPhotoMeta>
  zip: ZipReader
}

export interface ImportResult {
  /** New shops saved. */
  added: number
  /** Shops that were here and were replaced. */
  overwritten: number
  /** Shops that were here and were left as they are. */
  keptExisting: number
  /** Shops whose save failed. */
  failed: number
  /** From the preview (broken shops in the file). */
  skippedShops: number
  /** Photos not imported (preview + unreadable images). */
  skippedPhotos: number
  /** Ids of the shops saved (added or overwritten), in file order. */
  shopIds: string[]
}

export interface ImportOptions {
  overwrite: boolean
  onProgress?: (done: number, total: number) => void
}

async function readJson(zip: ZipReader, name: string): Promise<unknown[]> {
  if (!zip.has(name)) throw new CardFileError('broken', `${name} missing`)
  try {
    return parseJsonArray(await zip.text(name), name)
  } catch (e) {
    if (e instanceof CardFileError) throw e
    throw new CardFileError('broken', `${name}: ${e instanceof Error ? e.message : String(e)}`)
  }
}

/** Look inside a card file (the extension is not looked at: ZIP + manifest.json decide). */
export async function previewCard(file: Blob): Promise<CardPreview> {
  let zip: ZipReader
  try {
    zip = await openZip(file)
  } catch (e) {
    if (e instanceof ZipFormatError) throw new CardFileError('not-card', e.message)
    throw e
  }
  if (!zip.has(ENTRY.manifest)) throw new CardFileError('not-card', 'no manifest.json')
  let manifestText: string
  try {
    manifestText = await zip.text(ENTRY.manifest)
  } catch {
    throw new CardFileError('broken', 'manifest.json unreadable')
  }
  const manifest = parseManifest(manifestText)

  const [rawShops, rawTags, rawPhotos] = [await readJson(zip, ENTRY.shops), await readJson(zip, ENTRY.tags), await readJson(zip, ENTRY.photos)]

  const tags: Tag[] = []
  const tagById = new Map<string, Tag>()
  for (const raw of rawTags) {
    const t = readTag(raw)
    if (t && !tagById.has(t.id)) {
      tags.push(t)
      tagById.set(t.id, t)
    }
  }
  const photos = new Map<string, CardPhotoMeta>()
  for (const raw of rawPhotos) {
    const p = readPhotoMeta(raw)
    if (p && !photos.has(p.id)) photos.set(p.id, p)
  }

  const shops: Shop[] = []
  const seen = new Set<string>()
  let skippedShops = 0
  let skippedPhotos = 0
  for (const raw of rawShops) {
    const s = readShop(raw)
    if (!s || seen.has(s.id)) {
      skippedShops++
      continue
    }
    seen.add(s.id)
    // photos: described in photos.json for this shop, with both images in the file
    const photoIds = s.photoIds.filter((id) => {
      const ok = photos.get(id)?.shopId === s.id && zip.has(ENTRY.large(id)) && zip.has(ENTRY.small(id))
      if (!ok) skippedPhotos++
      return ok
    })
    // tag ids: only tags of the file, of the right kind
    const fixed: Shop = { ...s, photoIds }
    for (const { kind, field } of TAG_FIELDS) fixed[field] = s[field].filter((id) => tagById.get(id)?.kind === kind)
    shops.push(fixed)
  }

  const here = await db.shops.bulkGet(shops.map((s) => s.id))
  const existingIds = shops.filter((_, i) => here[i] !== undefined).map((s) => s.id)
  const existing = new Set(existingIds)
  return {
    kind: manifest.kind,
    exportedAt: manifest.exportedAt,
    appVersion: manifest.appVersion,
    shops,
    newIds: shops.filter((s) => !existing.has(s.id)).map((s) => s.id),
    existingIds,
    skippedShops,
    skippedPhotos,
    tags,
    photos,
    zip,
  }
}

/** File tag id -> tag id on this device (merging by kind + normalized key). */
async function importTags(tags: readonly Tag[]): Promise<Map<string, string>> {
  const map = new Map<string, string>()
  await db.transaction('rw', db.tags, async () => {
    for (const t of tags) {
      const same = await db.tags.where('[kind+normalizedKey]').equals([t.kind, t.normalizedKey]).first()
      if (same) {
        map.set(t.id, same.id)
        continue
      }
      const id = (await db.tags.get(t.id)) ? newId() : t.id
      await db.tags.add({ id, kind: t.kind, name: t.name, normalizedKey: t.normalizedKey, createdAt: t.createdAt })
      map.set(t.id, id)
    }
  })
  return map
}

interface ReadPhoto {
  meta: CardPhotoMeta
  large: Blob
  small: Blob
}

/** Save the card's shops, one transaction per shop. */
export async function importCard(preview: CardPreview, options: ImportOptions): Promise<ImportResult> {
  const { overwrite, onProgress } = options
  const result: ImportResult = {
    added: 0,
    overwritten: 0,
    keptExisting: 0,
    failed: 0,
    skippedShops: preview.skippedShops,
    skippedPhotos: preview.skippedPhotos,
    shopIds: [],
  }
  const existingNow = new Set((await db.shops.bulkGet(preview.shops.map((s) => s.id))).filter((s) => s).map((s) => s!.id))
  const toImport = preview.shops.filter((s) => overwrite || !existingNow.has(s.id))
  result.keptExisting = preview.shops.length - toImport.length

  // a backup brings every tag (unused ones too); a share only the tags of the shops taken
  const used = new Set(toImport.flatMap((s) => [...s.genreTagIds, ...s.useTagIds, ...s.areaTagIds]))
  const tagMap = await importTags(preview.kind === 'backup' ? preview.tags : preview.tags.filter((t) => used.has(t.id)))

  let done = 0
  onProgress?.(0, toImport.length)
  for (const s of toImport) {
    try {
      // images are read (and CRC-checked) before the transaction: an IndexedDB transaction
      // must not wait for anything else. At most 3 photos (6 images) are in memory.
      const read: ReadPhoto[] = []
      for (const id of s.photoIds) {
        const meta = preview.photos.get(id)!
        try {
          const large = new Blob([new Uint8Array(await preview.zip.bytes(ENTRY.large(id)))], { type: 'image/jpeg' })
          const small = new Blob([new Uint8Array(await preview.zip.bytes(ENTRY.small(id)))], { type: 'image/jpeg' })
          read.push({ meta, large, small })
        } catch (e) {
          if (!(e instanceof ZipCrcError || e instanceof ZipFormatError)) throw e
          result.skippedPhotos++
        }
      }
      const replaced = await saveShop(s, read, preview.kind, tagMap, overwrite)
      if (replaced === undefined) {
        result.keptExisting++
      } else {
        if (replaced) result.overwritten++
        else result.added++
        result.shopIds.push(s.id)
      }
    } catch (e) {
      console.error(e)
      result.failed++
    }
    onProgress?.(++done, toImport.length)
  }
  return result
}

/** true = replaced a shop, false = added, undefined = already here and not overwritten. */
async function saveShop(s: Shop, photos: ReadPhoto[], kind: CardKind, tagMap: ReadonlyMap<string, string>, overwrite: boolean): Promise<boolean | undefined> {
  return db.transaction('rw', db.shops, db.photos, db.tags, async () => {
    const existing = await db.shops.get(s.id)
    if (existing && !overwrite) return undefined
    if (existing) await db.photos.where('shopId').equals(s.id).delete()

    const photoIds: string[] = []
    for (const { meta, large, small } of photos) {
      // the id is kept unless another shop's photo already has it
      const id = (await db.photos.get(meta.id)) ? newId() : meta.id
      const photo: Photo = { id, shopId: s.id, small, large, width: meta.width, height: meta.height, createdAt: meta.createdAt }
      await db.photos.add(photo)
      photoIds.push(id)
    }

    const shop: Shop = { ...s, photoIds }
    for (const { field } of TAG_FIELDS) shop[field] = [...new Set(s[field].flatMap((id) => (tagMap.has(id) ? [tagMap.get(id)!] : [])))]
    if (kind === 'share') {
      const now = nowIso()
      shop.status = 'wishlist'
      shop.origin = 'shared'
      shop.createdAt = now
      shop.updatedAt = now
    }
    await db.shops.put(shop)
    return existing !== undefined
  })
}
