import { useRef, type ChangeEvent } from 'react'
import type { PhotoDraft } from '../hooks/usePhotoDrafts'
import { BlobImage } from './BlobImage'

interface Props {
  drafts: PhotoDraft[]
  notice?: string
  isFull: boolean
  onAddFiles: (files: File[]) => void
  onRemove: (key: string) => void
  /** Called when the button is tapped while already full. */
  onFull: () => void
  /** Move a photo left (-1) / right (+1). The "◀" / "▶" buttons appear only when this is given. */
  onMove?: (key: string, delta: -1 | 1) => void
}

/** Photo slots + "写真を追加" button. No capture attribute: iOS/Android show their own chooser. */
export function PhotoPicker({ drafts, notice, isFull, onAddFiles, onRemove, onFull, onMove }: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  // The cover is the first photo that will actually be saved.
  const coverKey = drafts.find((d) => d.state === 'ready' || d.state === 'saved')?.key

  const onChange = (e: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? [])
    e.target.value = '' // allow picking the same file again
    if (files.length > 0) onAddFiles(files)
  }

  return (
    <section className="photo-picker" aria-label="写真">
      {drafts.length > 0 && (
        <ul className="photo-slots">
          {drafts.map((d, i) => (
            <li key={d.key} className="photo-slot" data-state={d.state}>
              {d.state === 'ready' && <BlobImage blob={d.photo.small} alt={`写真${i + 1}`} className="photo-slot-img" />}
              {d.state === 'saved' && <BlobImage blob={d.small} alt={`写真${i + 1}`} className="photo-slot-img" />}
              {d.state === 'processing' && <span className="photo-slot-text">処理中…</span>}
              {d.state === 'error' && <span className="photo-slot-text photo-slot-error">{d.message}</span>}
              {d.key === coverKey && <span className="photo-cover-label">表紙</span>}
              <button type="button" className="photo-remove" aria-label={`写真${i + 1}を取り消す`} onClick={() => onRemove(d.key)}>
                ×
              </button>
              {onMove && i > 0 && (
                <button type="button" className="photo-move photo-move-left" aria-label={`写真${i + 1}を左へ`} onClick={() => onMove(d.key, -1)}>
                  ◀
                </button>
              )}
              {onMove && i < drafts.length - 1 && (
                <button type="button" className="photo-move photo-move-right" aria-label={`写真${i + 1}を右へ`} onClick={() => onMove(d.key, 1)}>
                  ▶
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
      <button type="button" className="btn btn-secondary btn-block" onClick={() => (isFull ? onFull() : inputRef.current?.click())}>
        写真を追加
      </button>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        hidden
        data-testid="photo-input"
        onChange={onChange}
      />
      {notice && (
        <p className="notice" role="alert">
          {notice}
        </p>
      )}
    </section>
  )
}
