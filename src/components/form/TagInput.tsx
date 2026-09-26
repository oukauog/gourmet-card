import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react'
import { suggestTags } from '../../db/tags'
import type { Tag, TagKind } from '../../db/types'
import { addTagDraft, draftFromTag, removeTagDraft, withoutChosen, type TagDraft } from '../../lib/tagDraft'

const SUGGEST_LIMIT = 8

interface Props {
  kind: Exclude<TagKind, 'use'>
  label: string
  placeholder: string
  value: TagDraft[]
  onChange: (value: TagDraft[]) => void
}

/**
 * Genre / area tags: chips (x to remove) + a text field. Focusing the field (even empty) shows
 * existing tags; typing narrows them. Enter or "追加" adds the text; a new tag is created only
 * when the form is saved.
 */
export function TagInput({ kind, label, placeholder, value, onChange }: Props) {
  const [text, setText] = useState('')
  const [open, setOpen] = useState(false)
  const [candidates, setCandidates] = useState<Tag[]>([])
  const inputRef = useRef<HTMLInputElement>(null)
  const closeTimer = useRef<ReturnType<typeof setTimeout>>(undefined)
  const labelId = useId()

  useEffect(() => {
    if (!open) return
    let active = true
    suggestTags(kind, text, SUGGEST_LIMIT + value.length).then((tags) => {
      if (active) setCandidates(withoutChosen(tags, value).slice(0, SUGGEST_LIMIT))
    })
    return () => {
      active = false
    }
  }, [open, text, kind, value])

  useEffect(() => () => clearTimeout(closeTimer.current), [])

  const addText = async () => {
    if (text.trim() === '') return
    const known = await suggestTags(kind, text)
    onChange(addTagDraft(value, text, known))
    setText('')
  }

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== 'Enter') return
    e.preventDefault() // never submit the form from here
    if (e.nativeEvent.isComposing || e.keyCode === 229) return // Japanese IME is still converting
    void addText()
  }

  return (
    <div className="form-field" role="group" aria-labelledby={labelId}>
      <span className="form-label" id={labelId}>
        {label}
      </span>
      <div className="tag-box">
        {value.map((d) => (
          <span key={d.key} className="tag-chip">
            {d.name}
            <button type="button" className="tag-chip-remove" aria-label={`${d.name}を外す`} onClick={() => onChange(removeTagDraft(value, d.key))}>
              ×
            </button>
          </span>
        ))}
        <input
          ref={inputRef}
          className="tag-text"
          type="text"
          aria-label={`${label}を入力`}
          placeholder={placeholder}
          enterKeyHint="done"
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={onKeyDown}
          onFocus={() => {
            clearTimeout(closeTimer.current)
            setOpen(true)
          }}
          // a short delay so that tapping a candidate still counts
          onBlur={() => {
            closeTimer.current = setTimeout(() => setOpen(false), 200)
          }}
        />
        {text.trim() !== '' && (
          <button type="button" className="tag-add" onMouseDown={(e) => e.preventDefault()} onClick={() => void addText()}>
            追加
          </button>
        )}
      </div>
      {open && candidates.length > 0 && (
        <div className="tag-suggest" role="group" aria-label={`${label}の候補`}>
          {candidates.map((t) => (
            <button
              key={t.id}
              type="button"
              className="tag-candidate"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                onChange([...value, draftFromTag(t)])
                setText('')
                inputRef.current?.focus()
              }}
            >
              {t.name}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
