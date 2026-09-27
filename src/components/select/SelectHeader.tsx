import '../../styles/select.css'

interface Props {
  count: number
  onCancel: () => void
}

/** Top bar in selection mode: "キャンセル" and "3店を選択中" (spec 4.5.3). */
export function SelectHeader({ count, onCancel }: Props) {
  return (
    <header className="topbar home-topbar select-topbar">
      <button type="button" className="btn btn-text" onClick={onCancel}>
        キャンセル
      </button>
      <h1 className="topbar-title select-title" aria-live="polite">
        {count > 0 ? `${count}店を選択中` : 'お店を選んでください'}
      </h1>
      <span className="topbar-spacer" />
    </header>
  )
}
