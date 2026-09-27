import '../../styles/select.css'

interface Props {
  count: number
  /** Selected shops that are not on screen now (another tab / filtered out). */
  hidden: number
  onSend: () => void
}

/** Bar fixed at the bottom in selection mode: "3店を送る" (spec 4.5.3). */
export function SelectSendBar({ count, hidden, onSend }: Props) {
  return (
    <div className="select-bar" data-testid="select-bar">
      {hidden > 0 && <p className="select-hidden">うち{hidden}店は今の表示の外</p>}
      <button type="button" className="btn btn-primary btn-block" disabled={count === 0} onClick={onSend}>
        {count > 0 ? `${count}店を送る` : '送る'}
      </button>
    </div>
  )
}
