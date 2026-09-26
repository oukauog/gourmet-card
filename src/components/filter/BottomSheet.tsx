import { useEffect, useId, useLayoutEffect, useRef, type ReactNode } from 'react'
import { lockPageScroll } from './scrollLock'

interface Props {
  title: string
  onClose: () => void
  /** Right side of the heading (e.g. "クリア"). */
  headerAction?: ReactNode
  /** Bottom of the sheet (e.g. "N件を表示"). */
  footer?: ReactNode
  children: ReactNode
}

/**
 * Panel from the bottom of the screen (spec 4.1.1). Dark backdrop; tapping it or Esc closes.
 * Not a history entry. While open, the page behind does not scroll (scrollLock.ts).
 */
export function BottomSheet({ title, onClose, headerAction, footer, children }: Props) {
  const titleId = useId()
  const sheetRef = useRef<HTMLDivElement>(null)
  const onCloseRef = useRef(onClose)
  useEffect(() => {
    onCloseRef.current = onClose
  })

  useLayoutEffect(() => lockPageScroll(), [])

  useEffect(() => {
    sheetRef.current?.focus()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCloseRef.current()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  return (
    <div className="sheet-backdrop" data-testid="sheet-backdrop" onClick={onClose}>
      <div
        ref={sheetRef}
        className="sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sheet-head">
          <h2 className="sheet-title" id={titleId}>
            {title}
          </h2>
          {headerAction}
        </div>
        <div className="sheet-body">{children}</div>
        {footer && <div className="sheet-foot">{footer}</div>}
      </div>
    </div>
  )
}
