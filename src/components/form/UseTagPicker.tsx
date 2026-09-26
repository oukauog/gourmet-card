import { useEffect, useId, useState, type KeyboardEvent } from 'react'
import { listTags } from '../../db/tags'
import type { Tag } from '../../db/types'
import { addTagDraft, draftFromTag, toggleTagDraft, type TagDraft } from '../../lib/tagDraft'

interface Props {
  value: TagDraft[]
  onChange: (value: TagDraft[]) => void
}

/**
 * "使い道": every existing use tag as a chip, tap to put on / take off. "＋追加" opens a field
 * for a new one (created only when the form is saved).
 */
export function UseTagPicker({ value, onChange }: Props) {
  const [known, setKnown] = useState<Tag[]>([])
  const [adding, setAdding] = useState(false)
  const [text, setText] = useState('')
  const labelId = useId()

  useEffect(() => {
    let active = true
    listTags('use').then((tags) => {
      if (active) setKnown(tags)
    })
    return () => {
      active = false
    }
  }, [])

  // existing tags first (name order), then the new ones of this form
  const chips = [...known.map(draftFromTag), ...value.filter((d) => !known.some((k) => k.normalizedKey === d.key))]
  const chosen = new Set(value.map((d) => d.key))

  const add = () => {
    if (text.trim() !== '') onChange(addTagDraft(value, text, known))
    setText('')
    setAdding(false)
  }
  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== 'Enter') return
    e.preventDefault()
    if (e.nativeEvent.isComposing || e.keyCode === 229) return
    add()
  }

  return (
    <div className="form-field" role="group" aria-labelledby={labelId}>
      <span className="form-label" id={labelId}>
        使い道
      </span>
      <div className="use-chips">
        {chips.map((d) => (
          <button
            key={d.key}
            type="button"
            className="use-chip"
            aria-pressed={chosen.has(d.key)}
            onClick={() => onChange(toggleTagDraft(value, d))}
          >
            {d.name}
          </button>
        ))}
        {!adding && (
          <button type="button" className="use-add" onClick={() => setAdding(true)}>
            ＋追加
          </button>
        )}
      </div>
      {adding && (
        <div className="use-new">
          <input
            className="text-input"
            type="text"
            aria-label="新しい使い道"
            placeholder="例: テラス席"
            enterKeyHint="done"
            autoComplete="off"
            autoFocus
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={onKeyDown}
          />
          <button type="button" className="btn btn-secondary" onClick={add}>
            追加
          </button>
        </div>
      )}
    </div>
  )
}
