import { useEffect, useRef, useState } from 'react'
import type { CardExport, ExportProgress } from '../../db/exportCards'
import { canShareFile, downloadFile, formatSize, makeFile, shareFile } from '../../lib/shareFile'
import { BottomSheet } from '../filter/BottomSheet'
import '../../styles/filter.css'
import '../../styles/data.css'

interface Props {
  title: string
  /** Build the file (called once, when the sheet opens). */
  prepare: (onProgress: (p: ExportProgress) => void) => Promise<CardExport>
  /** After the share sheet reported success, or after "ファイルとして保存" (e.g. to record the backup time). */
  onDelivered?: (how: 'shared' | 'saved') => void
  onClose: () => void
}

type State =
  | { step: 'preparing'; progress?: ExportProgress }
  | { step: 'ready'; file: File; canShare: boolean; notice?: string; errorName?: string }
  | { step: 'sent' }
  | { step: 'failed'; errorName: string }

/**
 * Two steps (spec 4.5.2): the tap that opened this sheet only PREPARES the file; the share
 * sheet is opened by a second tap ("共有メニューを開く"), because iPhone Safari refuses
 * navigator.share after a long task. "ファイルとして保存" is always there.
 */
export function SendSheet({ title, prepare, onDelivered, onClose }: Props) {
  const [state, setState] = useState<State>({ step: 'preparing' })
  const job = useRef<Promise<CardExport>>(undefined)
  const prepareRef = useRef(prepare)

  useEffect(() => {
    let active = true
    // one job even when React runs the effect twice (development)
    job.current ??= prepareRef.current((progress) => active && setState({ step: 'preparing', progress }))
    job.current.then(
      (r) => {
        if (!active) return
        const file = makeFile(r.blob, r.fileName, r.mime)
        setState({ step: 'ready', file, canShare: canShareFile(file) })
      },
      (e: unknown) => {
        console.error(e)
        if (active) setState({ step: 'failed', errorName: e instanceof Error ? e.name : String(e) })
      },
    )
    return () => {
      active = false
    }
  }, [])

  useEffect(() => {
    if (state.step !== 'sent') return
    const t = setTimeout(onClose, 1200)
    return () => clearTimeout(t)
  }, [state.step, onClose])

  const share = async (file: File) => {
    try {
      const outcome = await shareFile(file)
      if (outcome === 'cancelled') return // closed the share sheet: back to this sheet, nothing said
      onDelivered?.('shared')
      setState({ step: 'sent' })
    } catch (e) {
      console.error(e)
      setState((s) =>
        s.step === 'ready'
          ? { ...s, notice: '共有できませんでした。「ファイルとして保存」をお試しください', errorName: e instanceof Error ? e.name : String(e) }
          : s,
      )
    }
  }

  const save = (file: File) => {
    downloadFile(file, file.name)
    onDelivered?.('saved')
  }

  return (
    <BottomSheet title={title} onClose={onClose}>
      <div className="send-sheet" aria-live="polite">
        {state.step === 'preparing' && (
          <p className="send-status">
            準備しています…
            {state.progress && state.progress.photosTotal > 0 && ` 写真 ${state.progress.photosDone}/${state.progress.photosTotal}`}
          </p>
        )}
        {state.step === 'failed' && (
          <>
            <p className="send-status">ファイルを作れませんでした</p>
            <p className="error-detail">{state.errorName}</p>
          </>
        )}
        {state.step === 'sent' && <p className="send-status">送りました</p>}
        {state.step === 'ready' && (
          <>
            <p className="send-status">準備できました（{formatSize(state.file.size)}）</p>
            <p className="send-file-name">{state.file.name}</p>
            {state.canShare && (
              <button type="button" className="btn btn-primary btn-block" onClick={() => void share(state.file)}>
                共有メニューを開く
              </button>
            )}
            {state.notice && (
              <div role="alert">
                <p className="notice">{state.notice}</p>
                {state.errorName && <p className="error-detail">{state.errorName}</p>}
              </div>
            )}
            <button type="button" className="btn btn-secondary btn-block send-save" onClick={() => save(state.file)}>
              ファイルとして保存
            </button>
          </>
        )}
      </div>
    </BottomSheet>
  )
}
