// Values of the register / edit form (spec 4.2 / 4.2.1) and their conversions. Pure.
import type { Shop, ShopStatus, Tag } from '../db/types'
import { draftFromTag, type TagDraft } from './tagDraft'

export interface ShopFormValues {
  name: string
  status: ShopStatus
  /** 1..50 or undefined (not rated). */
  rating: number | undefined
  genres: TagDraft[]
  uses: TagDraft[]
  areas: TagDraft[]
  /** '' = not chosen. */
  prefecture: string
  mapUrl: string
  memo: string
}

/** What the save functions receive (tags: existing by id, new by name). */
export interface ShopFormData {
  name: string
  status: ShopStatus
  rating: number | undefined
  prefecture: string | undefined
  mapUrl: string | undefined
  memo: string | undefined
  genres: { id?: string; name: string }[]
  uses: { id?: string; name: string }[]
  areas: { id?: string; name: string }[]
}

/** New shop: "手札" and everything else empty. */
export function emptyShopForm(): ShopFormValues {
  return { name: '', status: 'visited', rating: undefined, genres: [], uses: [], areas: [], prefecture: '', mapUrl: '', memo: '' }
}

/** Current values of a saved shop. Tag ids that no longer exist are skipped. */
export function shopFormFromShop(shop: Shop, tagById: ReadonlyMap<string, Tag>): ShopFormValues {
  const drafts = (ids: string[]) =>
    ids.flatMap((id) => {
      const t = tagById.get(id)
      return t ? [draftFromTag(t)] : []
    })
  return {
    name: shop.name,
    status: shop.status,
    rating: shop.rating,
    genres: drafts(shop.genreTagIds),
    uses: drafts(shop.useTagIds),
    areas: drafts(shop.areaTagIds),
    prefecture: shop.prefecture ?? '',
    mapUrl: shop.mapUrl ?? '',
    memo: shop.memo ?? '',
  }
}

const tagKeys = (l: TagDraft[]) => l.map((d) => d.key).join('\n')

/** True when nothing a user can see has changed (used for "変更を破棄しますか？"). */
export function sameShopForm(a: ShopFormValues, b: ShopFormValues): boolean {
  return (
    a.name === b.name &&
    a.status === b.status &&
    a.rating === b.rating &&
    tagKeys(a.genres) === tagKeys(b.genres) &&
    tagKeys(a.uses) === tagKeys(b.uses) &&
    tagKeys(a.areas) === tagKeys(b.areas) &&
    a.prefecture === b.prefecture &&
    a.mapUrl === b.mapUrl &&
    a.memo === b.memo
  )
}

const optional = (s: string) => (s.trim() === '' ? undefined : s)

/** Form values -> save input. The map URL is trimmed; blank strings become "not set". Memo keeps its line breaks. */
export function shopFormToData(v: ShopFormValues): ShopFormData {
  const tags = (l: TagDraft[]) => l.map(({ id, name }) => (id ? { id, name } : { name }))
  return {
    name: v.name,
    status: v.status,
    rating: v.rating,
    prefecture: optional(v.prefecture),
    mapUrl: optional(v.mapUrl.trim()),
    memo: optional(v.memo),
    genres: tags(v.genres),
    uses: tags(v.uses),
    areas: tags(v.areas),
  }
}
