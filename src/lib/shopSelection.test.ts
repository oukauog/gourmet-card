import { describe, expect, it } from 'vitest'
import { allShownSelected, existingSelection, hiddenSelectedCount, selectShown, sendOrder, toggleSelection, unselectShown } from './shopSelection'

describe('shop selection (construction 8b)', () => {
  it('toggle: select / unselect, the order of choosing is kept', () => {
    let s = toggleSelection([], 'b')
    s = toggleSelection(s, 'a')
    expect(s).toEqual(['b', 'a'])
    expect(toggleSelection(s, 'b')).toEqual(['a'])
    expect(toggleSelection(toggleSelection(s, 'c'), 'c')).toEqual(['b', 'a'])
  })

  it('all shown selected: only when there are shown shops and all are selected', () => {
    expect(allShownSelected(['a', 'b', 'x'], ['a', 'b'])).toBe(true)
    expect(allShownSelected(['a'], ['a', 'b'])).toBe(false)
    expect(allShownSelected(['a'], [])).toBe(false)
  })

  it('select shown adds the missing ones; unselect shown removes only the shown ones', () => {
    expect(selectShown(['x', 'b'], ['a', 'b', 'c'])).toEqual(['x', 'b', 'a', 'c'])
    expect(selectShown([], [])).toEqual([])
    expect(unselectShown(['x', 'b', 'a', 'y'], ['a', 'b', 'c'])).toEqual(['x', 'y'])
  })

  it('hidden count: selected shops not on screen (other tab / filtered out)', () => {
    expect(hiddenSelectedCount(['a', 'x', 'y'], ['a', 'b'])).toBe(2)
    expect(hiddenSelectedCount(['a'], ['a', 'b'])).toBe(0)
    expect(hiddenSelectedCount([], [])).toBe(0)
  })

  it('send order: the list order of every shop (both tabs), not the order of choosing', () => {
    const all = ['w1', 'v1', 'v2', 'w2', 'v3'] // newest first, 手札 and 行きたい mixed
    expect(sendOrder(['v3', 'w1', 'v2'], all)).toEqual(['w1', 'v2', 'v3'])
    expect(sendOrder(['gone', 'v1'], all)).toEqual(['v1'])
    expect(sendOrder([], all)).toEqual([])
  })

  it('existing selection drops ids that are no longer in the list', () => {
    expect(existingSelection(['a', 'gone', 'b'], ['b', 'a'])).toEqual(['a', 'b'])
  })
})
