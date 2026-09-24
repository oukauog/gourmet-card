import { useState } from 'react'
import { PhotoPicker } from '../components/PhotoPicker'
import { createShopWithPhotos } from '../db/createShopWithPhotos'
import { usePhotoDrafts } from '../hooks/usePhotoDrafts'

interface Props {
  onCancel: () => void
  onSaved: (shopId: string) => void
}

/** Minimal register screen (spec 4.2): photos + name, save button fixed at the bottom. */
export function RegisterScreen({ onCancel, onSaved }: Props) {
  const photos = usePhotoDrafts()
  const [name, setName] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string>()
  // Diagnostic (temporary): phones have no console, so show the exception on screen.
  const [errorDetail, setErrorDetail] = useState<string>()

  const canSave = name.trim() !== '' && !photos.isProcessing && !saving

  const save = async () => {
    if (!canSave) return
    setSaving(true)
    setError(undefined)
    setErrorDetail(undefined)
    try {
      const shop = await createShopWithPhotos({ name }, photos.readyPhotos)
      onSaved(shop.id)
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
        <button type="button" className="btn btn-text" onClick={onCancel}>
          キャンセル
        </button>
        <h1 className="topbar-title">お店を登録</h1>
        <span className="topbar-spacer" />
      </header>

      <form
        className="register-form"
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
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </label>

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
