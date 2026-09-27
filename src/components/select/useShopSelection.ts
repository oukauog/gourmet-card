import { useState } from 'react'
import { selectShown, toggleSelection, unselectShown } from '../../lib/shopSelection'

/**
 * Selection mode of the list (construction 8b). State of the screen only: not in the URL, the
 * history, the settings or the list kept in memory (a new visit starts without it).
 */
export function useShopSelection() {
  const [selecting, setSelecting] = useState(false)
  const [selected, setSelected] = useState<string[]>([])
  return {
    selecting,
    selected,
    start: () => {
      setSelected([])
      setSelecting(true)
    },
    /** Leave the mode and drop the selection (キャンセル, or after sending). */
    finish: () => {
      setSelecting(false)
      setSelected([])
    },
    toggle: (id: string) => setSelected((s) => toggleSelection(s, id)),
    selectShown: (shownIds: readonly string[]) => setSelected((s) => selectShown(s, shownIds)),
    unselectShown: (shownIds: readonly string[]) => setSelected((s) => unselectShown(s, shownIds)),
  }
}
