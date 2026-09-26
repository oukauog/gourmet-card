import { describe, expect, it } from 'vitest'
import { addTagDraft, draftFromTag, removeTagDraft, toggleTagDraft, withoutChosen, type KnownTag } from './tagDraft'

const RAMEN: KnownTag = { id: 't1', name: 'ラーメン', normalizedKey: 'ラーメン' }
const CAFE: KnownTag = { id: 't2', name: 'Cafe', normalizedKey: 'cafe' }

describe('addTagDraft', () => {
  it('adds a new name (trimmed) without an id', () => {
    expect(addTagDraft([], '  海鮮 ', [RAMEN])).toEqual([{ key: '海鮮', name: '海鮮' }])
  })

  it('uses the existing tag (id and spelling) when the normalized key matches', () => {
    expect(addTagDraft([], 'ＣＡＦＥ', [RAMEN, CAFE])).toEqual([{ key: 'cafe', name: 'Cafe', id: 't2' }])
  })

  it('ignores blanks and duplicates in the same form', () => {
    const one = addTagDraft([], 'cafe', [CAFE])
    expect(addTagDraft(one, ' CAFE ', [CAFE])).toEqual(one)
    expect(addTagDraft(one, '   ', [CAFE])).toEqual(one)
    const two = addTagDraft([], '寿司', [])
    expect(addTagDraft(two, '寿司', [])).toEqual(two)
  })

  it('keeps the order of adding', () => {
    let l = addTagDraft([], '寿司', [])
    l = addTagDraft(l, 'ラーメン', [RAMEN])
    l = addTagDraft(l, '海鮮', [])
    expect(l.map((d) => d.name)).toEqual(['寿司', 'ラーメン', '海鮮'])
  })

  it('does not change the given list', () => {
    const l = [draftFromTag(RAMEN)]
    addTagDraft(l, '海鮮', [])
    expect(l).toHaveLength(1)
  })
})

describe('remove / toggle / withoutChosen', () => {
  it('removes by key', () => {
    const l = [draftFromTag(RAMEN), draftFromTag(CAFE)]
    expect(removeTagDraft(l, 'cafe')).toEqual([draftFromTag(RAMEN)])
  })

  it('toggles on and off', () => {
    const on = toggleTagDraft([], draftFromTag(CAFE))
    expect(on).toEqual([draftFromTag(CAFE)])
    expect(toggleTagDraft(on, draftFromTag(CAFE))).toEqual([])
  })

  it('drops candidates already chosen', () => {
    expect(withoutChosen([RAMEN, CAFE], [draftFromTag(CAFE)])).toEqual([RAMEN])
    expect(withoutChosen([RAMEN, CAFE], [{ key: 'ラーメン', name: 'ラーメン' }])).toEqual([CAFE])
  })
})
