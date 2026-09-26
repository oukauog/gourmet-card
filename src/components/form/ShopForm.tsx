import { useState } from 'react'
import type { PhotoSlot } from '../../db/saveShopForm'
import type { ShopStatus } from '../../db/types'
import { usePhotoDrafts, type PhotoDraft, type SavedPhoto } from '../../hooks/usePhotoDrafts'
import { PREFECTURES } from '../../lib/prefectures'
import { sameShopForm, type ShopFormValues } from '../../lib/shopForm'
import { isOpenableUrl } from '../../lib/shopView'
import { PhotoPicker } from '../PhotoPicker'
import { RatingInput } from './RatingInput'
import { TagInput } from './TagInput'
import { UseTagPicker } from './UseTagPicker'
import '../../styles/form.css'

interface Props {
  /** Center of the top bar: "お店を登録" / "店を編集". */
  title: string
  initialValues: ShopFormValues
  /** Edit screen: the shop's saved photos in order. */
  initialPhotos?: readonly SavedPhoto[]
  /** Ask "変更を破棄しますか？" on cancel when something changed (edit screen). */
  confirmDiscard: boolean
  onCancel: () => void
  /** Save. Throw to show the error (the form stays). On success the caller leaves the screen. */
  onSubmit: (values: ShopFormValues, photos: PhotoSlot[]) => Promise<void>
}

const STATUSES: { value: ShopStatus; label: string }[] = [
  { value: 'visited', label: '手札' },
  { value: 'wishlist', label: '行きたい' },
]

const photoKeys = (ds: readonly PhotoDraft[]) => ds.map((d) => d.key).join('\n')

/**
 * The one form for register and edit (spec 4.2.1). Order: photos, name, 手札/行きたい, rating,
 * genre, use, prefecture, area, map URL, memo. Only the name is required. Nothing is written
 * to the DB before "保存" (new tags and photo changes included).
 */
export function ShopForm({ title, initialValues, initialPhotos = [], confirmDiscard, onCancel, onSubmit }: Props) {
  const photos = usePhotoDrafts(initialPhotos)
  const [initial] = useState(() => ({ values: initialValues, photos: initialPhotos.map((p) => `saved-${p.id}`).join('\n') }))
  const [v, setV] = useState<ShopFormValues>(initialValues)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string>()
  // Diagnostic (temporary): phones have no console, so show the exception on screen.
  const [errorDetail, setErrorDetail] = useState<string>()

  const set = <K extends keyof ShopFormValues>(key: K, value: ShopFormValues[K]) => setV((cur) => ({ ...cur, [key]: value }))
  const dirty = !sameShopForm(initial.values, v) || photoKeys(photos.drafts) !== initial.photos
  const canSave = v.name.trim() !== '' && !photos.isProcessing && !saving
  const urlWarning = v.mapUrl.trim() !== '' && !isOpenableUrl(v.mapUrl)
  // keep a value that is not in the list (e.g. from an import) selectable
  const prefectures = v.prefecture && !PREFECTURES.includes(v.prefecture) ? [v.prefecture, ...PREFECTURES] : PREFECTURES

  const cancel = () => {
    if (confirmDiscard && dirty && !window.confirm('変更を破棄しますか？')) return
    onCancel()
  }

  const save = async () => {
    if (!canSave) return
    setSaving(true)
    setError(undefined)
    setErrorDetail(undefined)
    try {
      await onSubmit(v, photos.slots)
    } catch (e) {
      console.error(e)
      setError('保存できませんでした。もう一度お試しください')
      setErrorDetail(e instanceof Error ? `${e.name}: ${e.message}` : String(e))
      setSaving(false)
    }
  }

  return (
    <div className="screen register-screen">
      <header className="topbar">
        <button type="button" className="btn btn-text" onClick={cancel}>
          キャンセル
        </button>
        <h1 className="topbar-title">{title}</h1>
        <span className="topbar-spacer" />
      </header>

      <form
        className="register-form shop-form"
        // no browser validation: a non-URL map link only shows a hint, it never blocks saving
        noValidate
        onSubmit={(e) => {
          e.preventDefault()
          void save()
        }}
      >
        <PhotoPicker
          drafts={photos.drafts}
          notice={photos.notice}
          isFull={photos.isFull}
          onAddFiles={photos.addFiles}
          onRemove={photos.remove}
          onFull={photos.showLimitNotice}
          onMove={photos.move}
        />

        <label className="field">
          <span className="visually-hidden">店名</span>
          <input
            className="text-input"
            type="text"
            placeholder="店名（必須）"
            enterKeyHint="done"
            autoCapitalize="off"
            autoCorrect="off"
            autoComplete="off"
            value={v.name}
            onChange={(e) => set('name', e.target.value)}
          />
        </label>

        <div className="form-field">
          <span className="form-label" id="form-status-label">
            手札／行きたい
          </span>
          <div className="segmented" role="radiogroup" aria-labelledby="form-status-label">
            {STATUSES.map((s) => (
              <button
                key={s.value}
                type="button"
                role="radio"
                aria-checked={v.status === s.value}
                className="segmented-option"
                onClick={() => set('status', s.value)}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>

        <div className="form-field" role="group" aria-labelledby="form-rating-label">
          <span className="form-label" id="form-rating-label">
            評価
          </span>
          <RatingInput value={v.rating} onChange={(r) => set('rating', r)} />
        </div>

        <TagInput kind="genre" label="ジャンル" placeholder="例: ラーメン" value={v.genres} onChange={(t) => set('genres', t)} />

        <UseTagPicker value={v.uses} onChange={(t) => set('uses', t)} />

        <div className="form-field">
          <label className="form-label" htmlFor="form-prefecture">
            県
          </label>
          <select id="form-prefecture" className="text-input form-select" value={v.prefecture} onChange={(e) => set('prefecture', e.target.value)}>
            <option value="">未選択</option>
            {prefectures.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </div>

        <TagInput kind="area" label="エリア" placeholder="例: 総曲輪" value={v.areas} onChange={(t) => set('areas', t)} />

        <div className="form-field">
          <label className="form-label" htmlFor="form-map-url">
            GoogleマップURL
          </label>
          <input
            id="form-map-url"
            className="text-input"
            type="url"
            inputMode="url"
            placeholder="https://maps.app.goo.gl/…"
            autoCapitalize="off"
            autoCorrect="off"
            autoComplete="off"
            value={v.mapUrl}
            onChange={(e) => set('mapUrl', e.target.value)}
          />
          {urlWarning && <span className="form-hint form-warn">http で始まる URL でないと、店ページにボタンが出ません</span>}
        </div>

        <div className="form-field">
          <label className="form-label" htmlFor="form-memo">
            メモ
          </label>
          <textarea id="form-memo" className="text-input form-memo" rows={4} value={v.memo} onChange={(e) => set('memo', e.target.value)} />
        </div>

        {error && (
          <div role="alert">
            <p className="notice">{error}</p>
            {errorDetail && <p className="error-detail">{errorDetail}</p>}
          </div>
        )}

        <div className="save-bar">
          <button type="submit" className="btn btn-primary btn-block" disabled={!canSave}>
            {saving ? '保存中…' : '保存'}
          </button>
        </div>
      </form>
    </div>
  )
}
