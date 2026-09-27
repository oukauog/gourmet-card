import { useState } from 'react'
import { importCard, type CardPreview, type ImportResult } from '../../db/importCards'
import type { ShopStatus } from '../../db/types'
import { formatJst } from '../../lib/version'
import { BottomSheet } from '../filter/BottomSheet'
import '../../styles/filter.css'
import '../../styles/data.css'

interface Props {
  preview: CardPreview
  onClose: () => void
  onOpenShop: (id: string) => void
  onOpenList: (tab: ShopStatus) => void
  /** After a successful import (e.g. to forget the list kept in memory). */
  onImported?: (result: ImportResult) => void
}

type Step = { step: 'confirm' } | { step: 'importing'; done: number; total: number } | { step: 'done'; result: ImportResult } | { step: 'failed'; errorName: string }

const KIND_LABEL = { share: 'お裾分け（友人から）', backup: 'バックアップ（自分の端末の復元用）' } as const

/** What is in the file -> "取り込む" -> the result (spec 4.5.2). */
export function ImportSheet({ preview, onClose, onOpenShop, onOpenList, onImported }: Props) {
  const [overwrite, setOverwrite] = useState(false)
  const [s, setS] = useState<Step>({ step: 'confirm' })
  const existing = preview.existingIds.length
  const toImport = preview.newIds.length + (overwrite ? existing : 0)
  const when = formatJst(preview.exportedAt)

  const run = async () => {
    setS({ step: 'importing', done: 0, total: toImport })
    try {
      const result = await importCard(preview, { overwrite, onProgress: (done, total) => setS({ step: 'importing', done, total }) })
      onImported?.(result)
      setS({ step: 'done', result })
    } catch (e) {
      console.error(e)
      setS({ step: 'failed', errorName: e instanceof Error ? e.name : String(e) })
    }
  }

  // no closing while saving
  const close = () => {
    if (s.step !== 'importing') onClose()
  }

  return (
    <BottomSheet title="ファイルから取り込む" onClose={close}>
      <div className="import-sheet" aria-live="polite">
        {s.step === 'confirm' && (
          <>
            <dl className="import-facts">
              <dt>種類</dt>
              <dd data-testid="import-kind">{KIND_LABEL[preview.kind]}</dd>
              {when && (
                <>
                  <dt>書き出し</dt>
                  <dd>{when}</dd>
                </>
              )}
            </dl>
            <ul className="import-counts">
              <li>新しいお店 {preview.newIds.length}件</li>
              {existing > 0 && <li>もう入っているお店 {existing}件</li>}
              {preview.skippedShops > 0 && <li className="import-warn">読めないお店 {preview.skippedShops}件（取り込みません）</li>}
              {preview.skippedPhotos > 0 && <li className="import-warn">読めない写真 {preview.skippedPhotos}枚（取り込みません）</li>}
            </ul>
            {existing > 0 && (
              <div className="import-choice">
                <p className="import-choice-title" id="import-overwrite">
                  もう入っているお店は
                </p>
                <div className="import-choice-options" role="radiogroup" aria-labelledby="import-overwrite">
                  <button type="button" role="radio" aria-checked={!overwrite} className="option-chip" onClick={() => setOverwrite(false)}>
                    取り込まない
                  </button>
                  <button type="button" role="radio" aria-checked={overwrite} className="option-chip" onClick={() => setOverwrite(true)}>
                    上書きする
                  </button>
                </div>
              </div>
            )}
            {preview.kind === 'share' && <p className="import-note">「行きたい」として取り込みます</p>}
            <button type="button" className="btn btn-primary btn-block" disabled={toImport === 0} onClick={() => void run()}>
              取り込む{toImport > 0 && `（${toImport}件）`}
            </button>
          </>
        )}

        {s.step === 'importing' && (
          <p className="send-status">
            取り込んでいます… {s.done}/{s.total}
          </p>
        )}

        {s.step === 'failed' && (
          <>
            <p className="send-status">取り込めませんでした</p>
            <p className="error-detail">{s.errorName}</p>
          </>
        )}

        {s.step === 'done' && <ImportDone result={s.result} preview={preview} onOpenShop={onOpenShop} onOpenList={onOpenList} onClose={onClose} />}
      </div>
    </BottomSheet>
  )
}

function ImportDone({ result, preview, onOpenShop, onOpenList, onClose }: { result: ImportResult; preview: CardPreview } & Omit<Props, 'preview' | 'onImported'>) {
  const n = result.added + result.overwritten
  const notes: string[] = []
  if (result.keptExisting > 0) notes.push(`${result.keptExisting}件はもう入っているため取り込みませんでした`)
  if (result.overwritten > 0) notes.push(`${result.overwritten}件は上書きしました`)
  if (result.failed > 0) notes.push(`${result.failed}件は保存できませんでした`)
  if (result.skippedShops > 0) notes.push(`読めないお店 ${result.skippedShops}件`)
  if (result.skippedPhotos > 0) notes.push(`読めない写真 ${result.skippedPhotos}枚`)
  return (
    <>
      <p className="send-status" data-testid="import-result">
        {n}件取り込みました{notes.length > 0 && `（${notes.join('、')}）`}
      </p>
      {result.shopIds.length === 1 && (
        <button type="button" className="btn btn-primary btn-block" onClick={() => onOpenShop(result.shopIds[0])}>
          お店を見る
        </button>
      )}
      {result.shopIds.length > 1 && (
        <button type="button" className="btn btn-primary btn-block" onClick={() => onOpenList(preview.kind === 'share' ? 'wishlist' : 'visited')}>
          一覧を見る
        </button>
      )}
      <button type="button" className="btn btn-secondary btn-block send-save" onClick={onClose}>
        閉じる
      </button>
    </>
  )
}
