// DEV ONLY (construction 3 look comparison; removed in construction 3a).
// Duplicate existing shops so the tile list can be judged with many tiles and with stars.
// Uses only the public data API.
import { createShopWithPhotos } from '../db/createShopWithPhotos'
import { getPhotosForShop } from '../db/photos'
import { deleteShop, listShops } from '../db/shops'
import type { PhotoInput } from '../db/types'

export const SAMPLE_SUFFIX = '（見本）'
export const SAMPLE_TARGET = 24

const randomRating = () => 1 + Math.floor(Math.random() * 50)

/** Add copies ("<name>（見本）", random rating, same photos or none) until there are >= target shops. */
export async function addSampleShops(target = SAMPLE_TARGET): Promise<number> {
  const shops = await listShops()
  const originals = shops.filter((s) => !s.name.endsWith(SAMPLE_SUFFIX))
  let count = shops.length
  let added = 0
  for (let i = 0; count < target; i++) {
    const src = originals.length > 0 ? originals[i % originals.length] : undefined
    const name = (src?.name ?? `サンプル${i + 1}`) + SAMPLE_SUFFIX
    // every 4th copy has no photo, every 7th is unrated, so all tile kinds appear
    const withPhoto = src !== undefined && i % 4 !== 3
    const photos: PhotoInput[] = withPhoto
      ? (await getPhotosForShop(src.id)).map(({ small, large, width, height }) => ({ small, large, width, height }))
      : []
    const rating = i % 7 === 6 ? undefined : randomRating()
    await createShopWithPhotos({ name, rating }, photos)
    count++
    added++
  }
  return added
}

/** Delete every shop whose name ends with "（見本）". */
export async function removeSampleShops(): Promise<number> {
  const samples = (await listShops()).filter((s) => s.name.endsWith(SAMPLE_SUFFIX))
  for (const s of samples) await deleteShop(s.id)
  return samples.length
}
