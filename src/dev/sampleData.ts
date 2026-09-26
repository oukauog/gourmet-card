// DEV ONLY (look comparisons of construction 3 / 4).
// Duplicate existing shops so the tile list can be judged with many tiles and with stars,
// and give the copies tags / place / map URL / memo (no input screen yet: construction 5)
// so the shop page can be judged. Uses only the public data API.
import { createShopWithPhotos } from '../db/createShopWithPhotos'
import { getPhotosForShop } from '../db/photos'
import { deleteShop, listShops } from '../db/shops'
import { INITIAL_USE_TAGS } from '../db/seedUseTags'
import { deleteTag, findOrCreateTag, listTags } from '../db/tags'
import type { PhotoInput, ShopInput, TagKind } from '../db/types'
import { normalizeTagKey } from '../lib/tagKey'

export const SAMPLE_SUFFIX = '（見本）'
export const SAMPLE_TARGET = 24

export const SAMPLE_GENRES = ['ラーメン', '寿司', '海鮮', '焼肉', 'カフェ', '居酒屋'] as const
export const SAMPLE_USES = ['個室あり'] as const
export const SAMPLE_AREAS = ['総曲輪', '八尾'] as const
const SAMPLE_TAGS: { kind: TagKind; names: readonly string[] }[] = [
  { kind: 'genre', names: SAMPLE_GENRES },
  { kind: 'use', names: SAMPLE_USES },
  { kind: 'area', names: SAMPLE_AREAS },
]

const PLACES: { prefecture?: string; city?: string }[] = [
  { prefecture: '富山県', city: '富山市' },
  { prefecture: '富山県', city: '高岡市' },
  { prefecture: '石川県', city: '金沢市' },
  { prefecture: '富山県', city: '富山市' },
  {},
]

export const SAMPLE_LONG_MEMO = [
  'カウンター8席。昼は11:30から、売り切れ次第終了。',
  'おすすめ: 白エビのかき揚げ、ブリしゃぶ（冬だけ）',
  '予約 https://example.com/reservation/ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789',
  '駐車場は店の裏に3台。',
].join('\n')
const SHORT_MEMO = '日曜定休。'

const MAPS_SEARCH = 'https://www.google.com/maps/search/?api=1&query='

const randomRating = () => 1 + Math.floor(Math.random() * 50)

/**
 * Fields of the i-th copy, decided by i only (no randomness), so that "everything",
 * "some" and "nothing" all appear. i = 0 has every field.
 *   genres: i%4 -> 2 / 1 / 0 / 1     use: i%3 == 0     place: i%5 (area tags when i%5 == 0)
 *   map URL: i%3 != 2                memo: i%3 -> long / short / none
 */
export function sampleFields(i: number): {
  genres: string[]
  uses: string[]
  areas: string[]
  prefecture?: string
  city?: string
  mapUrl?: string
  memo?: string
} {
  const g = (k: number) => SAMPLE_GENRES[(i + k) % SAMPLE_GENRES.length]
  const genres = [[g(0), g(1)], [g(0)], [], [g(0)]][i % 4]
  const uses = i % 3 === 0 ? [SAMPLE_USES[0]] : []
  const place = PLACES[i % PLACES.length]
  const areas = i % PLACES.length === 0 ? [...SAMPLE_AREAS] : []
  const query = [place.city, areas[0]].filter(Boolean).join(' ') || '富山駅'
  const mapUrl = i % 3 !== 2 ? MAPS_SEARCH + encodeURIComponent(query) : undefined
  const memo = [SAMPLE_LONG_MEMO, SHORT_MEMO, undefined][i % 3]
  return { genres, uses, areas, ...place, mapUrl, memo }
}

async function tagIds(kind: TagKind, names: string[]): Promise<string[]> {
  const ids: string[] = []
  for (const name of names) ids.push((await findOrCreateTag(kind, name)).id)
  return ids
}

/** Add copies ("<name>（見本）", random rating, same photos or none, fields by i) until there are >= target shops. */
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
    // every 5th copy is a wishlist shop (for the 行きたい tab, construction 6)
    const status = i % 5 === 4 ? 'wishlist' : 'visited'
    const f = sampleFields(i)
    const input: ShopInput = {
      name,
      status,
      rating,
      prefecture: f.prefecture,
      city: f.city,
      mapUrl: f.mapUrl,
      memo: f.memo,
      genreTagIds: await tagIds('genre', f.genres),
      useTagIds: await tagIds('use', f.uses),
      areaTagIds: await tagIds('area', f.areas),
    }
    await createShopWithPhotos(input, photos)
    count++
    added++
  }
  return added
}

/**
 * Delete every shop whose name ends with "（見本）", then the sample tags that no shop uses any
 * more. deleteTag also detaches the tag from shops, so a tag still used by any shop is kept.
 * The initial use tags (個室あり / 駐車場あり, seedUseTags) are never deleted here.
 */
export async function removeSampleShops(): Promise<number> {
  const samples = (await listShops()).filter((s) => s.name.endsWith(SAMPLE_SUFFIX))
  for (const s of samples) await deleteShop(s.id)

  const used = new Set((await listShops()).flatMap((s) => [...s.genreTagIds, ...s.useTagIds, ...s.areaTagIds]))
  const sampleKeys = new Set(SAMPLE_TAGS.flatMap(({ kind, names }) => names.map((n) => `${kind}:${normalizeTagKey(n)}`)))
  for (const n of INITIAL_USE_TAGS) sampleKeys.delete(`use:${normalizeTagKey(n)}`)
  for (const tag of await listTags()) {
    if (sampleKeys.has(`${tag.kind}:${tag.normalizedKey}`) && !used.has(tag.id)) await deleteTag(tag.id)
  }
  return samples.length
}
