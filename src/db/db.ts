import Dexie, { type Table } from 'dexie'
import type { Photo, Setting, Shop, Tag } from './types'

export const DB_NAME = 'gourmet-card'

// NOTE for later constructions:
// Never edit an existing version's schema. To change the schema, add
// `this.version(N + 1).stores({...}).upgrade(tx => ...)` below and keep
// version(1) as is, so data on users' phones is migrated, not lost.
export class GourmetDB extends Dexie {
  declare shops: Table<Shop, string>
  declare photos: Table<Photo, string>
  declare tags: Table<Tag, string>
  declare settings: Table<Setting, string>

  constructor(name: string = DB_NAME) {
    super(name)
    this.version(1).stores({
      shops:
        'id, status, createdAt, updatedAt, rating, prefecture, city, stationId, *genreTagIds, *areaTagIds, *useTagIds',
      photos: 'id, shopId',
      // Same kind + same normalized key must be unique.
      tags: 'id, kind, &[kind+normalizedKey]',
      settings: 'key',
    })
  }
}

/** Create a database instance (tests can pass their own name). */
export function createDb(name?: string): GourmetDB {
  return new GourmetDB(name)
}

/** The app's single database instance. Opened lazily on first use. */
export const db = createDb()
