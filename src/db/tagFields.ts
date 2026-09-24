import type { TagKind } from './types'

export type TagField = 'areaTagIds' | 'genreTagIds' | 'useTagIds'

const FIELD_BY_KIND: Record<TagKind, TagField> = {
  area: 'areaTagIds',
  genre: 'genreTagIds',
  use: 'useTagIds',
}

/** The Shop array field that holds tags of the given kind. */
export function tagFieldFor(kind: TagKind): TagField {
  return FIELD_BY_KIND[kind]
}

export const TAG_FIELDS: readonly { kind: TagKind; field: TagField }[] = (
  Object.keys(FIELD_BY_KIND) as TagKind[]
).map((kind) => ({ kind, field: FIELD_BY_KIND[kind] }))
