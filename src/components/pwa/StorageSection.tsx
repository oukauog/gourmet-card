import { useEffect, useState } from 'react'
import { getSetting } from '../../db/settings'
import type { PersistResult } from '../../db/types'
import { INSTALL_STEPS, MOVE_SHOPS_NOTE, REMOVE_ICON_NOTE } from '../../lib/homeScreenGuide'
import { persistRecordLine } from '../../lib/persistText'
import { canRequestPersist, readStorageState, requestPersist, type StorageState } from '../../pwa/persist'
import '../../styles/data.css'
import './pwa.css'

/** "約 42MB" (1 MB = 1024 × 1024 bytes; under 1 MB in KB). */
function aboutSize(bytes: number): string {
  if (bytes >= 1024 * 1024) return `約 ${Math.round(bytes / (1024 * 1024))}MB`
  return `約 ${Math.max(1, Math.round(bytes / 1024))}KB`
}

/** "この端末での保存" and "ホーム画面で使う" on the data screen (construction 9, spec 4.6). */
type Shown = StorageState & { requestedAt?: string; result?: PersistResult }

const readShown = async (): Promise<Shown> => {
  const [s, requestedAt, result] = await Promise.all([readStorageState(), getSetting('persistRequestedAt'), getSetting('persistResult')])
  return { ...s, requestedAt, result }
}

export function StorageSection() {
  const [state, setState] = useState<Shown>()
  const [asking, setAsking] = useState(false)
  useEffect(() => {
    let active = true
    void readShown().then((s) => active && setState(s))
    return () => {
      active = false
    }
  }, [])

  // "保護を求める" (construction 9a): any time, even with no shop; then read everything again
  const ask = async () => {
    setAsking(true)
    await requestPersist()
    setState(await readShown())
    setAsking(false)
  }
  const record = persistRecordLine(state?.requestedAt, state?.result)

  return (
    <section className="data-section" aria-labelledby="data-storage-title">
      <h2 className="data-title" id="data-storage-title">
        この端末での保存
      </h2>
      {state?.persisted !== undefined && (
        <p className="data-last" data-testid="storage-persisted">
          {state.persisted ? '保護されています' : '保護されていません'}
        </p>
      )}
      {record && (
        <p className="data-record" data-testid="persist-record">
          {record}
        </p>
      )}
      {state?.persisted === false && canRequestPersist() && (
        <button type="button" className="btn btn-secondary btn-block" disabled={asking} onClick={() => void ask()}>
          保護を求める
        </button>
      )}
      {state?.usage !== undefined && (
        <p className="data-text" data-testid="storage-usage">
          使用量の目安：{aboutSize(state.usage)}
        </p>
      )}
      <h3 className="data-subtitle">ホーム画面で使う</h3>
      <p className="data-text">iPhone・iPad（Safari）</p>
      <ol className="data-steps">
        {INSTALL_STEPS.ios.map((s) => (
          <li key={s}>{s}</li>
        ))}
      </ol>
      <p className="data-text">Android（Chrome など）</p>
      <ol className="data-steps">
        {INSTALL_STEPS.android.map((s) => (
          <li key={s}>{s}</li>
        ))}
      </ol>
      <p className="data-text">{MOVE_SHOPS_NOTE}</p>
      <p className="data-text">{REMOVE_ICON_NOTE}</p>
    </section>
  )
}
