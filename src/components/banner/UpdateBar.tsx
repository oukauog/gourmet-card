import './banner.css'

/** "新しい版があります［更新］" (construction 9). Reloads only when tapped. */
export function UpdateBar({ onUpdate }: { onUpdate: () => void }) {
  return (
    <div className="app-banner" role="status" data-banner="update">
      <span className="app-banner-text">新しい版があります</span>
      <button type="button" className="app-banner-action" onClick={onUpdate}>
        更新
      </button>
    </div>
  )
}
