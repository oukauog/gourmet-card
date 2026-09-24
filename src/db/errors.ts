// Error types thrown by the data layer. Screens can branch on `instanceof`.

/** Input is invalid (empty name, bad rating, bad reorder list, immutable field, ...). */
export class ValidationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ValidationError'
  }
}

/**
 * The target record does not exist.
 * (Not named "NotFoundError": Dexie converts errors with DOMException names such as
 * NotFoundError / ConstraintError into its own DexieError, losing the class.)
 */
export class RecordNotFoundError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'RecordNotFoundError'
  }
}

/** A shop already has the maximum number of photos (3). */
export class PhotoLimitError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'PhotoLimitError'
  }
}

/** Renaming a tag would collide with another tag of the same kind (use mergeTags instead). */
export class TagConflictError extends Error {
  readonly existingTagId: string
  constructor(message: string, existingTagId: string) {
    super(message)
    this.name = 'TagConflictError'
    this.existingTagId = existingTagId
  }
}
