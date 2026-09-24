/**
 * UUID v4 built from crypto.getRandomValues (RFC 4122 section 4.4).
 * getRandomValues works outside secure contexts, unlike crypto.randomUUID.
 */
export function uuidV4FromRandomValues(): string {
  const b = crypto.getRandomValues(new Uint8Array(16))
  b[6] = (b[6] & 0x0f) | 0x40 // version 4 (0100xxxx)
  b[8] = (b[8] & 0x3f) | 0x80 // variant (10xxxxxx)
  const hex = Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}

/**
 * New unique ID (UUID v4).
 * crypto.randomUUID exists only in secure contexts (https / localhost). On a phone opening the
 * dev server via http://192.168.x.x it is missing, so fall back to getRandomValues.
 */
export function newId(): string {
  return typeof crypto.randomUUID === 'function' ? crypto.randomUUID() : uuidV4FromRandomValues()
}
