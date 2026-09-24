// DEV ONLY: sample data buttons for checking the list with many shops.
// Lazily imported behind `import.meta.env.DEV` (HomeScreen), so it is not in the production build.
import { useState } from 'react'
import { addSampleShops, removeSampleShops } from './sampleData'
import './devBar.css'

interface Props {
  onDataChanged: () => void
}

export function DevSampleBar({ onDataChanged }: Props) {
  const [busy, setBusy] = useState(false)

  const run = async (job: () => Promise<unknown>) => {
    setBusy(true)
    try {
      await job()
    } finally {
      setBusy(false)
      onDataChanged()
    }
  }

  return (
    <div className="dev-bar" data-testid="dev-sample-bar">
      <span className="dev-bar-label">開発用:</span>
      <button type="button" className="dev-chip" disabled={busy} onClick={() => void run(addSampleShops)}>
        見本用に増やす
      </button>
      <button type="button" className="dev-chip" disabled={busy} onClick={() => void run(removeSampleShops)}>
        見本データを消す
      </button>
    </div>
  )
}
