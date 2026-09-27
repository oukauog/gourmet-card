// Write shops into a card file (construction 8, spec 4.5.2 / 5).
//   one shop (kind "share"): the shop, its photos (large + small) and its tags
//   every shop (kind "backup"): all shops, all photos, ALL tags (unused ones too). No settings.
// Photos are read one by one while the ZIP is assembled (zipStore.ts), never all at once.
import { appVersion } from '../lib/appVersion'
import { buildManifest, cardFileName, ENTRY, isSafePhotoId, shopForFile, type CardKind, type CardPhotoMeta } from '../lib/cardFormat'
import type { CardFileType } from '../lib/cardFileType'
import { nowIso } from '../lib/time'
import { buildZip, type ZipEntrySource } from '../lib/zipStore'
import { db } from './db'
import { RecordNotFoundError } from './errors'
import type { Shop, Tag } from './types'

export interface ExportProgress {
  /** Photos written so far / all photos. */
  photosDone: number
  photosTotal: number
}

export interface CardExport {
  blob: Blob
  fileName: string
  mime: string
  kind: CardKind
  shopCount: number
  photoCount: number
}

const json = (v: unknown) => () => new Blob([JSON.stringify(v)], { type: 'application/json' })

async function writeCard(
  kind: CardKind,
  shops: Shop[],
  tags: Tag[],
  fileType: CardFileType,
  onProgress?: (p: ExportProgress) => void,
  shopNameForFile?: string,
): Promise<CardExport> {
  const exportedAt = nowIso()
  // photo records hold Blob references only (the bytes are read when their entry is written)
  const metas: CardPhotoMeta[] = []
  for (const shop of shops) {
    for (const id of shop.photoIds) {
      if (!isSafePhotoId(id)) continue
      const p = await db.photos.get(id)
      if (p && p.shopId === shop.id) metas.push({ id: p.id, shopId: p.shopId, width: p.width, height: p.height, createdAt: p.createdAt })
    }
  }
  const image = (id: string, size: 'large' | 'small') => async () => {
    const p = await db.photos.get(id)
    if (!p) throw new RecordNotFoundError(`photo disappeared during export: ${id}`)
    return p[size]
  }
  const entries: ZipEntrySource[] = [
    { name: ENTRY.manifest, load: json(buildManifest(kind, exportedAt, appVersion(), shops.length, metas.length)) },
    { name: ENTRY.shops, load: json(shops.map(shopForFile)) },
    { name: ENTRY.tags, load: json(tags) },
    { name: ENTRY.photos, load: json(metas) },
    ...metas.flatMap((m) => [
      { name: ENTRY.large(m.id), load: image(m.id, 'large') },
      { name: ENTRY.small(m.id), load: image(m.id, 'small') },
    ]),
  ]
  const fixed = 4
  onProgress?.({ photosDone: 0, photosTotal: metas.length })
  const blob = await buildZip(entries, new Date(exportedAt), (done) => {
    // two entries (large + small) per photo
    if (done > fixed && (done - fixed) % 2 === 0) onProgress?.({ photosDone: (done - fixed) / 2, photosTotal: metas.length })
  })
  return {
    blob,
    fileName: cardFileName(kind, fileType.extension, new Date(exportedAt), shopNameForFile),
    mime: fileType.mime,
    kind,
    shopCount: shops.length,
    photoCount: metas.length,
  }
}

/** One shop to send to a friend (kind "share"). */
export async function exportShopCard(shopId: string, fileType: CardFileType, onProgress?: (p: ExportProgress) => void): Promise<CardExport> {
  const shop = await db.shops.get(shopId)
  if (!shop) throw new RecordNotFoundError(`shop not found: ${shopId}`)
  const tagIds = [...shop.genreTagIds, ...shop.useTagIds, ...shop.areaTagIds]
  const tags = (await db.tags.bulkGet([...new Set(tagIds)])).filter((t): t is Tag => t !== undefined)
  return writeCard('share', [shop], tags, fileType, onProgress, shop.name)
}

/** Every shop, every photo and every tag (kind "backup"). */
export async function exportBackup(fileType: CardFileType, onProgress?: (p: ExportProgress) => void): Promise<CardExport> {
  const [shops, tags] = await Promise.all([db.shops.toArray(), db.tags.toArray()])
  // a stable order in the file (oldest first)
  shops.sort((a, b) => (a.createdAt < b.createdAt ? -1 : a.createdAt > b.createdAt ? 1 : a.id < b.id ? -1 : 1))
  tags.sort((a, b) => (a.createdAt < b.createdAt ? -1 : a.createdAt > b.createdAt ? 1 : a.id < b.id ? -1 : 1))
  return writeCard('backup', shops, tags, fileType, onProgress)
}
