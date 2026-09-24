/** New unique ID (UUID v4). */
export function newId(): string {
  return crypto.randomUUID()
}
