import JSZip from 'jszip'
import { describe, expect, it } from 'vitest'
import { buildZip, crc32, dosDateTime, openZip, ZipCrcError, ZipFormatError, type ZipEntrySource } from './zipStore'

const enc = new TextEncoder()
const bytesBlob = (b: number[] | Uint8Array) => new Blob([new Uint8Array(b)])
const DATE = new Date(2026, 8, 27, 21, 5, 30) // local time
const JSON_JA = JSON.stringify({ name: '白えび亭', memo: '天丼\n名物 🍤' })

const sample = (): ZipEntrySource[] => [
  { name: 'manifest.json', load: () => new Blob([JSON_JA]) },
  { name: 'empty.txt', load: () => new Blob([]) },
  { name: 'photos/a-large.jpg', load: () => bytesBlob(Array.from({ length: 5000 }, (_, i) => (i * 7) % 256)) },
  { name: 'photos/a-small.jpg', load: async () => bytesBlob([0xff, 0xd8, 0xff, 0xd9]) },
]

describe('crc32', () => {
  it('known values; can continue over chunks', () => {
    expect(crc32(enc.encode('123456789'))).toBe(0xcbf43926)
    expect(crc32(new Uint8Array())).toBe(0)
    const whole = enc.encode('hello world')
    expect(crc32(enc.encode(' world'), crc32(enc.encode('hello')))).toBe(crc32(whole))
  })
})

describe('buildZip / openZip', () => {
  it('round trip: same names and the same bytes (empty entry, Japanese JSON, binary)', async () => {
    const progress: string[] = []
    const zip = await buildZip(sample(), DATE, (d, t) => progress.push(`${d}/${t}`))
    expect(progress).toEqual(['1/4', '2/4', '3/4', '4/4'])
    const r = await openZip(zip)
    expect(r.names).toEqual(['manifest.json', 'empty.txt', 'photos/a-large.jpg', 'photos/a-small.jpg'])
    expect(await r.text('manifest.json')).toBe(JSON_JA)
    expect((await r.bytes('empty.txt')).length).toBe(0)
    const large = await r.bytes('photos/a-large.jpg')
    expect(large.length).toBe(5000)
    expect([...large.slice(0, 4)]).toEqual([0, 7, 14, 21])
    expect([...(await r.bytes('photos/a-small.jpg'))]).toEqual([0xff, 0xd8, 0xff, 0xd9])
    expect(r.has('nope')).toBe(false)
    await expect(r.bytes('nope')).rejects.toBeInstanceOf(ZipFormatError)
  })

  it('an empty ZIP is valid', async () => {
    const r = await openZip(await buildZip([], DATE))
    expect(r.names).toEqual([])
  })

  it('entries are loaded one at a time, in order', async () => {
    const log: string[] = []
    const entries: ZipEntrySource[] = ['a', 'b', 'c'].map((n) => ({
      name: n,
      load: async () => {
        log.push(`load ${n}`)
        return new Blob([n])
      },
    }))
    await buildZip(entries, DATE, (d) => log.push(`done ${d}`))
    expect(log).toEqual(['load a', 'done 1', 'load b', 'done 2', 'load c', 'done 3'])
  })

  it('rejects non-ASCII / duplicate entry names', async () => {
    await expect(buildZip([{ name: '写真.jpg', load: () => new Blob([]) }], DATE)).rejects.toBeInstanceOf(ZipFormatError)
    await expect(
      buildZip(
        [
          { name: 'a', load: () => new Blob([]) },
          { name: 'a', load: () => new Blob([]) },
        ],
        DATE,
      ),
    ).rejects.toBeInstanceOf(ZipFormatError)
  })

  it('DOS date / time', () => {
    const { date, time } = dosDateTime(DATE)
    expect([date >> 9, (date >> 5) & 15, date & 31]).toEqual([46, 9, 27])
    expect([time >> 11, (time >> 5) & 63, (time & 31) * 2]).toEqual([21, 5, 30])
  })

  it('a changed byte is found by the CRC check (only that entry)', async () => {
    const zip = await buildZip(sample(), DATE)
    const buf = new Uint8Array(await zip.arrayBuffer())
    // find the large photo's data: its first bytes 0,7,14,21,28 are unique in the file
    let at = -1
    for (let i = 0; i < buf.length - 5; i++) if (buf[i] === 0 && buf[i + 1] === 7 && buf[i + 2] === 14 && buf[i + 3] === 21 && buf[i + 4] === 28) at = i
    expect(at).toBeGreaterThan(0)
    buf[at + 100] ^= 0xff
    const r = await openZip(new Blob([buf]))
    await expect(r.bytes('photos/a-large.jpg')).rejects.toBeInstanceOf(ZipCrcError)
    expect([...(await r.bytes('photos/a-small.jpg'))]).toEqual([0xff, 0xd8, 0xff, 0xd9])
  })

  it('not a ZIP / cut off / too short -> ZipFormatError', async () => {
    await expect(openZip(new Blob(['hello, this is not a zip file at all.']))).rejects.toBeInstanceOf(ZipFormatError)
    await expect(openZip(new Blob([]))).rejects.toBeInstanceOf(ZipFormatError)
    const zip = await buildZip(sample(), DATE)
    await expect(openZip(zip.slice(0, zip.size - 10))).rejects.toBeInstanceOf(ZipFormatError)
    await expect(openZip(zip.slice(0, Math.floor(zip.size / 2)))).rejects.toBeInstanceOf(ZipFormatError)
    // a JPEG is not a ZIP either
    await expect(openZip(bytesBlob([0xff, 0xd8, ...new Array(100).fill(0), 0xff, 0xd9]))).rejects.toBeInstanceOf(ZipFormatError)
  })
})

describe('works with JSZip (an ordinary ZIP)', () => {
  it('JSZip reads our ZIP', async () => {
    const zip = await buildZip(sample(), DATE)
    const j = await JSZip.loadAsync(await zip.arrayBuffer())
    expect(Object.keys(j.files).sort()).toEqual(['empty.txt', 'manifest.json', 'photos/a-large.jpg', 'photos/a-small.jpg'])
    expect(await j.file('manifest.json')!.async('string')).toBe(JSON_JA)
    expect((await j.file('photos/a-large.jpg')!.async('uint8array')).length).toBe(5000)
    expect((await j.file('empty.txt')!.async('uint8array')).length).toBe(0)
  })

  it('we read a STORE ZIP made by JSZip (with a folder entry)', async () => {
    const j = new JSZip()
    j.file('manifest.json', JSON_JA)
    j.folder('photos')!.file('x-small.jpg', new Uint8Array([1, 2, 3]))
    j.file('empty.txt', '')
    const data = await j.generateAsync({ type: 'uint8array', compression: 'STORE' })
    const r = await openZip(new Blob([new Uint8Array(data)]))
    expect([...r.names].sort()).toEqual(['empty.txt', 'manifest.json', 'photos/x-small.jpg'])
    expect(await r.text('manifest.json')).toBe(JSON_JA)
    expect([...(await r.bytes('photos/x-small.jpg'))]).toEqual([1, 2, 3])
  })

  it('a compressed (DEFLATE) ZIP is refused', async () => {
    const j = new JSZip()
    j.file('manifest.json', JSON_JA.repeat(20))
    const data = await j.generateAsync({ type: 'uint8array', compression: 'DEFLATE' })
    await expect(openZip(new Blob([new Uint8Array(data)]))).rejects.toBeInstanceOf(ZipFormatError)
  })
})
