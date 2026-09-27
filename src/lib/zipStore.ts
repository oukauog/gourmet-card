// Uncompressed (STORE) ZIP writer / reader (construction 8, spec 5).
// Why not JSZip: a full backup can hold hundreds of photos, and JSZip keeps every file in memory.
// Here the writer reads ONE entry at a time (only to compute its CRC-32) and assembles the ZIP
// from the entries' Blobs (never one big ArrayBuffer). The reader only slices the parts it needs.
// No ZIP64, no encryption, no data descriptors on write; entry names must be ASCII.

/** The file is not a ZIP we can read (not a ZIP, cut off, compressed, encrypted, ZIP64 ...). */
export class ZipFormatError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ZipFormatError'
  }
}

/** The bytes of an entry do not match its CRC-32. */
export class ZipCrcError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ZipCrcError'
  }
}

// ---------- CRC-32 (IEEE, as in ZIP) ----------

const CRC_TABLE = (() => {
  const t = new Uint32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    t[n] = c >>> 0
  }
  return t
})()

/** CRC-32 of the bytes. Pass the previous result as `crc` to continue over several chunks. */
export function crc32(bytes: Uint8Array, crc = 0): number {
  let c = ~crc >>> 0
  for (let i = 0; i < bytes.length; i++) c = CRC_TABLE[(c ^ bytes[i]) & 0xff] ^ (c >>> 8)
  return ~c >>> 0
}

// ---------- write ----------

export interface ZipEntrySource {
  /** Path inside the ZIP (ASCII only, "/" separated). */
  name: string
  /** The content, read only when this entry's turn comes. */
  load: () => Promise<Blob> | Blob
}

const SIG_LOCAL = 0x04034b50
const SIG_CENTRAL = 0x02014b50
const SIG_END = 0x06054b50
const VERSION = 20 // 2.0: what a STORE-only archive needs
const MAX_U32 = 0xffffffff

/** DOS date and time (local time of the date; 2-second resolution; 1980..2107). */
export function dosDateTime(d: Date): { date: number; time: number } {
  const year = Math.min(Math.max(d.getFullYear(), 1980), 2107)
  return {
    date: ((year - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate(),
    time: (d.getHours() << 11) | (d.getMinutes() << 5) | Math.floor(d.getSeconds() / 2),
  }
}

const utf8 = new TextEncoder()

function asciiName(name: string): Uint8Array {
  if (name === '' || !/^[\x20-\x7e]+$/.test(name)) throw new ZipFormatError(`entry names must be ASCII: ${JSON.stringify(name)}`)
  return utf8.encode(name)
}

/**
 * Build a STORE ZIP. Entries are loaded one by one (for the CRC), and `onEntry(i, total)` is
 * called after each. The result keeps the entries' Blobs as they are.
 */
export async function buildZip(entries: readonly ZipEntrySource[], modified: Date, onEntry?: (done: number, total: number) => void): Promise<Blob> {
  if (entries.length > 0xffff) throw new ZipFormatError('too many entries for a ZIP without ZIP64')
  const { date, time } = dosDateTime(modified)
  const parts: BlobPart[] = []
  const central: Uint8Array[] = []
  const seen = new Set<string>()
  let offset = 0

  for (let i = 0; i < entries.length; i++) {
    const { name, load } = entries[i]
    if (seen.has(name)) throw new ZipFormatError(`duplicate entry: ${name}`)
    seen.add(name)
    const nameBytes = asciiName(name)
    const blob = await load()
    // read this entry only (for its CRC); the bytes are dropped right after
    const crc = crc32(new Uint8Array(await blob.arrayBuffer()))
    const size = blob.size
    if (size >= MAX_U32 || offset >= MAX_U32) throw new ZipFormatError('the ZIP would need ZIP64 (over 4 GB)')

    const local = new DataView(new ArrayBuffer(30 + nameBytes.length))
    local.setUint32(0, SIG_LOCAL, true)
    local.setUint16(4, VERSION, true)
    local.setUint16(6, 0, true) // flags
    local.setUint16(8, 0, true) // method: STORE
    local.setUint16(10, time, true)
    local.setUint16(12, date, true)
    local.setUint32(14, crc, true)
    local.setUint32(18, size, true)
    local.setUint32(22, size, true)
    local.setUint16(26, nameBytes.length, true)
    local.setUint16(28, 0, true) // extra length
    new Uint8Array(local.buffer).set(nameBytes, 30)

    const cen = new DataView(new ArrayBuffer(46 + nameBytes.length))
    cen.setUint32(0, SIG_CENTRAL, true)
    cen.setUint16(4, VERSION, true) // made by
    cen.setUint16(6, VERSION, true) // needed
    cen.setUint16(8, 0, true)
    cen.setUint16(10, 0, true)
    cen.setUint16(12, time, true)
    cen.setUint16(14, date, true)
    cen.setUint32(16, crc, true)
    cen.setUint32(20, size, true)
    cen.setUint32(24, size, true)
    cen.setUint16(28, nameBytes.length, true)
    // extra, comment, disk, internal attrs, external attrs: 0
    cen.setUint32(42, offset, true)
    new Uint8Array(cen.buffer).set(nameBytes, 46)

    parts.push(local.buffer, blob)
    central.push(new Uint8Array(cen.buffer))
    offset += 30 + nameBytes.length + size
    onEntry?.(i + 1, entries.length)
  }

  const centralSize = central.reduce((n, c) => n + c.length, 0)
  if (offset + centralSize >= MAX_U32) throw new ZipFormatError('the ZIP would need ZIP64 (over 4 GB)')
  const end = new DataView(new ArrayBuffer(22))
  end.setUint32(0, SIG_END, true)
  end.setUint16(8, entries.length, true)
  end.setUint16(10, entries.length, true)
  end.setUint32(12, centralSize, true)
  end.setUint32(16, offset, true)
  return new Blob([...parts, ...central.map((c) => c.buffer as ArrayBuffer), end.buffer], { type: 'application/zip' })
}

// ---------- read ----------

interface CentralEntry {
  name: string
  crc: number
  size: number
  localOffset: number
}

export interface ZipReader {
  /** Entry names in the order of the central directory. */
  readonly names: readonly string[]
  has(name: string): boolean
  /** Bytes of an entry. CRC-32 is checked (ZipCrcError). Unknown name: ZipFormatError. */
  bytes(name: string): Promise<Uint8Array>
  /** An entry as UTF-8 text (CRC checked). */
  text(name: string): Promise<string>
}

const view = async (blob: Blob, start: number, end: number) => {
  if (start < 0 || end > blob.size || start > end) throw new ZipFormatError('the file is cut off')
  return new DataView(await blob.slice(start, end).arrayBuffer())
}
const latin = new TextDecoder('latin1')
const utf8Decoder = new TextDecoder('utf-8', { fatal: false })

/**
 * Open a ZIP from its end (End of Central Directory) and read the central directory. Only the
 * directory is read now; entries are sliced out when asked for. Anything but STORE (method 0),
 * encrypted entries, ZIP64 and broken structures are ZipFormatError.
 */
export async function openZip(blob: Blob): Promise<ZipReader> {
  if (blob.size < 22) throw new ZipFormatError('not a ZIP file')
  // the EOCD is in the last 22 + 65535 (max comment) bytes
  const tailStart = Math.max(0, blob.size - (22 + 0xffff))
  const tail = await view(blob, tailStart, blob.size)
  let eocd = -1
  for (let i = tail.byteLength - 22; i >= 0; i--) {
    if (tail.getUint32(i, true) === SIG_END) {
      eocd = i
      break
    }
  }
  if (eocd < 0) throw new ZipFormatError('not a ZIP file (no end of central directory)')
  const diskEntries = tail.getUint16(eocd + 8, true)
  const count = tail.getUint16(eocd + 10, true)
  const cdSize = tail.getUint32(eocd + 12, true)
  const cdOffset = tail.getUint32(eocd + 16, true)
  if (tail.getUint16(eocd + 4, true) !== 0 || tail.getUint16(eocd + 6, true) !== 0 || diskEntries !== count) {
    throw new ZipFormatError('multi-disk ZIP files are not supported')
  }
  if (count === 0xffff || cdSize === MAX_U32 || cdOffset === MAX_U32) throw new ZipFormatError('ZIP64 is not supported')
  if (cdOffset + cdSize > tailStart + eocd) throw new ZipFormatError('the file is cut off or broken')

  const cd = await view(blob, cdOffset, cdOffset + cdSize)
  const entries = new Map<string, CentralEntry>()
  let p = 0
  for (let i = 0; i < count; i++) {
    if (p + 46 > cd.byteLength || cd.getUint32(p, true) !== SIG_CENTRAL) throw new ZipFormatError('broken central directory')
    const flags = cd.getUint16(p + 8, true)
    const method = cd.getUint16(p + 10, true)
    const crc = cd.getUint32(p + 16, true)
    const compressed = cd.getUint32(p + 20, true)
    const size = cd.getUint32(p + 24, true)
    const nameLen = cd.getUint16(p + 28, true)
    const extraLen = cd.getUint16(p + 30, true)
    const commentLen = cd.getUint16(p + 32, true)
    const localOffset = cd.getUint32(p + 42, true)
    if (p + 46 + nameLen > cd.byteLength) throw new ZipFormatError('broken central directory')
    const nameBytes = new Uint8Array(cd.buffer, cd.byteOffset + p + 46, nameLen)
    const name = flags & 0x800 ? utf8Decoder.decode(nameBytes) : latin.decode(nameBytes)
    if (flags & 0x1) throw new ZipFormatError(`encrypted entry: ${name}`)
    if (method !== 0) throw new ZipFormatError(`compressed entry (method ${method}): ${name}`)
    if (compressed !== size) throw new ZipFormatError(`broken entry size: ${name}`)
    if (size === MAX_U32 || localOffset === MAX_U32) throw new ZipFormatError('ZIP64 is not supported')
    if (!name.endsWith('/')) entries.set(name, { name, crc, size, localOffset }) // skip directory entries
    p += 46 + nameLen + extraLen + commentLen
  }

  const entry = (name: string) => {
    const e = entries.get(name)
    if (!e) throw new ZipFormatError(`no entry: ${name}`)
    return e
  }
  const bytes = async (name: string) => {
    const e = entry(name)
    const local = await view(blob, e.localOffset, e.localOffset + 30)
    if (local.getUint32(0, true) !== SIG_LOCAL) throw new ZipFormatError(`broken local header: ${name}`)
    const start = e.localOffset + 30 + local.getUint16(26, true) + local.getUint16(28, true)
    if (start + e.size > cdOffset) throw new ZipFormatError(`the file is cut off: ${name}`)
    const data = new Uint8Array(await blob.slice(start, start + e.size).arrayBuffer())
    if (data.length !== e.size) throw new ZipFormatError(`the file is cut off: ${name}`)
    if (crc32(data) !== e.crc) throw new ZipCrcError(`CRC mismatch: ${name}`)
    return data
  }
  return {
    names: [...entries.keys()],
    has: (name) => entries.has(name),
    bytes,
    text: async (name) => utf8Decoder.decode(await bytes(name)),
  }
}
