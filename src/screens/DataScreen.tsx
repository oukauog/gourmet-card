// "バックアップと取り込み" (#/data, construction 8, spec 4.5.2): back up every shop, import a
// file. (The trial extension switch of construction 8 was removed in construction 8a: .zip.)
import { useCallback, useEffect, useRef, useState } from 'react'
import { ImportSheet } from '../components/share/ImportSheet'
import { SendSheet } from '../components/share/SendSheet'
import { exportBackup } from '../db/exportCards'
import { previewCard, type CardPreview } from '../db/importCards'
import { getSetting, setSetting } from '../db/settings'
import { countShops } from '../db/shops'
import type { ShopStatus } from '../db/types'
import { CARD_FILE_TYPE } from '../lib/cardFileType'
import { CardFileError } from '../lib/cardFormat'
import { nowIso } from '../lib/time'
import { formatJst } from '../lib/version'
import '../styles/data.css'

interface Props {
  onBack: () => void
  onOpenShop: (id: string) => void
  onOpenList: (tab: ShopStatus) => void
  /** The list kept in memory is out of date (after an import). */
  onDataChanged: () => void
}

// often the cause on iPhone: a folder the Files app made by tapping the .zip was chosen
const NOT_CARD_HINT = '「ファイル」アプリで .zip をタップすると中身のフォルダができます。取り込むのはフォルダの中ではなく、.zip のファイルそのものです'

export function DataScreen({ onBack, onOpenShop, onOpenList, onDataChanged }: Props) {
  const [shopCount, setShopCount] = useState<number>()
  const [lastBackupAt, setLastBackupAt] = useState<string | null>()
  const [sending, setSending] = useState(false)
  const [reading, setReading] = useState(false)
  const [readError, setReadError] = useState<{ message: string; detail?: string; hint?: string }>()
  const [preview, setPreview] = useState<CardPreview>()
  const fileInput = useRef<HTMLInputElement>(null)

  const refresh = useCallback(
    () =>
      Promise.all([countShops(), getSetting('lastBackupAt')]).then(([n, last]) => {
        setShopCount(n)
        setLastBackupAt(last ?? null)
      }),
    [],
  )

  useEffect(() => {
    window.scrollTo(0, 0)
    let active = true
    Promise.all([countShops(), getSetting('lastBackupAt')]).then(([n, last]) => {
      if (!active) return
      setShopCount(n)
      setLastBackupAt(last ?? null)
    })
    return () => {
      active = false
    }
  }, [])

  const onBackupDelivered = async () => {
    await setSetting('lastBackupAt', nowIso())
    await refresh()
  }

  const pickFile = async (file: File | undefined) => {
    if (!file) return
    setReadError(undefined)
    setReading(true)
    try {
      setPreview(await previewCard(file))
    } catch (e) {
      console.error(e)
      if (e instanceof CardFileError) setReadError({ message: e.userMessage, hint: e.code === 'not-card' ? NOT_CARD_HINT : undefined })
      else setReadError({ message: 'ファイルを読めませんでした', detail: e instanceof Error ? e.name : String(e) })
    } finally {
      setReading(false)
    }
  }

  return (
    <div className="screen data-screen">
      <header className="topbar">
        <button type="button" className="btn btn-text" onClick={onBack}>
          ← 戻る
        </button>
        <h1 className="topbar-title">バックアップと取り込み</h1>
        <span className="topbar-spacer" />
      </header>

      <section className="data-section" aria-labelledby="data-backup-title">
        <h2 className="data-title" id="data-backup-title">
          バックアップ
        </h2>
        <p className="data-text">写真を含む全部のお店を1つのファイルにします。iPhone では共有メニューの「ファイルに保存」で iCloud Drive などに残してください。</p>
        <p className="data-last" data-testid="last-backup">
          {lastBackupAt === undefined ? ' ' : lastBackupAt ? `最後のバックアップ：${formatJst(lastBackupAt)}` : 'まだバックアップしていません'}
        </p>
        <button type="button" className="btn btn-primary btn-block" disabled={!shopCount} onClick={() => setSending(true)}>
          全店のバックアップを作る{shopCount !== undefined && `（${shopCount}件）`}
        </button>
      </section>

      <section className="data-section" aria-labelledby="data-import-title">
        <h2 className="data-title" id="data-import-title">
          取り込む
        </h2>
        <p className="data-text">友だちから届いたファイルは、LINE なら開いて「ファイルに保存」、AirDrop なら「ファイル」アプリに入ります。選ぶ画面の「最近使った項目」か、検索で「グルメカード」と入れると見つかります。</p>
        <button type="button" className="btn btn-secondary btn-block" disabled={reading} onClick={() => fileInput.current?.click()}>
          {reading ? '読み込んでいます…' : 'ファイルから取り込む'}
        </button>
        {/* no `accept`: iPhone may refuse unknown extensions listed there */}
        <input
          ref={fileInput}
          type="file"
          hidden
          data-testid="import-file"
          onChange={(e) => {
            const f = e.target.files?.[0]
            e.target.value = '' // the same file can be chosen again
            void pickFile(f)
          }}
        />
        {readError && (
          <div role="alert">
            <p className="notice">{readError.message}</p>
            {readError.detail && <p className="error-detail">{readError.detail}</p>}
          </div>
        )}
        {readError?.hint && <p className="data-hint">{readError.hint}</p>}
      </section>

      {sending && (
        <SendSheet
          title="全店のバックアップ"
          prepare={(onProgress) => exportBackup(CARD_FILE_TYPE, onProgress)}
          onDelivered={() => void onBackupDelivered()}
          onClose={() => setSending(false)}
        />
      )}

      {preview && (
        <ImportSheet
          preview={preview}
          onClose={() => setPreview(undefined)}
          onImported={() => {
            onDataChanged()
            void refresh()
          }}
          onOpenShop={onOpenShop}
          onOpenList={onOpenList}
        />
      )}
    </div>
  )
}
