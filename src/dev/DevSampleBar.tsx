// DEV ONLY (construction 3 look comparison; removed in construction 3a).
// Rendered behind `import.meta.env.DEV`, so it is dropped from the production build.
import { useState } from 'react'
import { addSampleShops, removeSampleShops } from './sampleData'
import type { TileVariant } from './sampleVariant'

interface Props {
  variant: TileVariant
  onVariant: (v: TileVariant) => void
  onDataChanged: () => void
}

export function DevSampleBar({ variant, onVariant, onDataChanged }: Props) {
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
      <span className="dev-bar-label">見本:</span>
      {(['a1', 'a2'] as const).map((v) => (
        <button
          key={v}
          type="button"
          className="dev-chip"
          aria-pressed={variant === v}
          onClick={() => onVariant(v)}
        >
          {v.toUpperCase()}
        </button>
      ))}
      <button type="button" className="dev-chip" disabled={busy} onClick={() => void run(addSampleShops)}>
        見本用に増やす
      </button>
      <button type="button" className="dev-chip" disabled={busy} onClick={() => void run(removeSampleShops)}>
        見本データを消す
      </button>
    </div>
  )
}
