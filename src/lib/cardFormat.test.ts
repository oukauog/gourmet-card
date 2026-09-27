import { describe, expect, it } from 'vitest'
import { cardFileName, fileNamePart, jstStamp, normalizeIso, parseManifest, readShop, readTag, CardFileError } from './cardFormat'

describe('file names', () => {
  it('Japan time stamp (UTC+9), across midnight', () => {
    expect(jstStamp(new Date('2026-09-27T12:05:59.000Z'))).toBe('20260927-2105')
    expect(jstStamp(new Date('2026-12-31T15:00:00.000Z'))).toBe('20270101-0000')
  })

  it('shop name: forbidden characters and line breaks -> _, at most 40 characters, never empty', () => {
    expect(fileNamePart('麺屋 "粋" a/b\\c:d*e?f<g>h|i')).toBe('麺屋 _粋_ a_b_c_d_e_f_g_h_i')
    expect(fileNamePart('一行目\n二行目\r\n')).toBe('一行目_二行目__')
    expect(fileNamePart('あ'.repeat(60))).toBe('あ'.repeat(40))
    expect(fileNamePart('🍜'.repeat(45))).toBe('🍜'.repeat(40)) // surrogate pairs are not cut
    expect(fileNamePart('   ')).toBe('_')
    expect(fileNamePart('..隠し')).toBe('_隠し')
  })

  it('share / backup names with the extension', () => {
    const at = new Date('2026-09-27T12:05:00.000Z')
    expect(cardFileName('share', '.zip', at, '白えび亭')).toBe('グルメカード_白えび亭.zip')
    expect(cardFileName('share', '.zip', at, 'a/b')).toBe('グルメカード_a_b.zip')
    expect(cardFileName('backup', '.zip', at)).toBe('グルメカード_バックアップ_20260927-2105.zip')
  })
})

describe('manifest and records', () => {
  it('manifest: counts default to 0, errors by kind', () => {
    const m = parseManifest(JSON.stringify({ format: 'gourmet-card', formatVersion: 1, kind: 'backup', exportedAt: '2026-09-27T21:05:00+09:00' }))
    expect(m).toEqual({ format: 'gourmet-card', formatVersion: 1, kind: 'backup', exportedAt: '2026-09-27T12:05:00.000Z', appVersion: '', shopCount: 0, photoCount: 0 })
    const err = (t: string) => {
      try {
        parseManifest(t)
      } catch (e) {
        return (e as CardFileError).code
      }
    }
    expect(err('{')).toBe('not-card')
    expect(err('[]')).toBe('not-card')
    expect(err(JSON.stringify({ format: 'gourmet-card', formatVersion: 1, kind: 'x' }))).toBe('not-card')
    expect(err(JSON.stringify({ format: 'gourmet-card', formatVersion: 3, kind: 'share' }))).toBe('too-new')
  })

  it('dates become ISO UTC; blank optional strings are not set; unknown keys dropped', () => {
    expect(normalizeIso('2026-09-27T21:05:00+09:00')).toBe('2026-09-27T12:05:00.000Z')
    expect(normalizeIso('nope')).toBeUndefined()
    const s = readShop({
      id: 'a',
      name: '  店  ',
      status: 'wishlist',
      origin: 'shared',
      photoIds: ['p', 'p'],
      genreTagIds: [],
      useTagIds: [],
      areaTagIds: [],
      memo: '  ',
      city: '富山市',
      extra: 'future field',
      createdAt: '2026-09-01',
      updatedAt: '2026-09-01T00:00:00Z',
    })
    expect(s).toStrictEqual({
      id: 'a',
      name: '店',
      status: 'wishlist',
      photoIds: ['p'],
      areaTagIds: [],
      genreTagIds: [],
      useTagIds: [],
      origin: 'shared',
      createdAt: '2026-09-01T00:00:00.000Z',
      updatedAt: '2026-09-01T00:00:00.000Z',
      city: '富山市',
    })
    expect(readTag({ id: 't', kind: 'genre', name: ' ＲＡＭＥＮ ', normalizedKey: 'wrong', createdAt: '2026-09-01T00:00:00Z' })).toEqual({
      id: 't',
      kind: 'genre',
      name: 'ＲＡＭＥＮ',
      normalizedKey: 'ramen',
      createdAt: '2026-09-01T00:00:00.000Z',
    })
    expect(readTag({ id: 't', kind: 'station', name: 'x', createdAt: '2026-09-01T00:00:00Z' })).toBeUndefined()
  })
})
