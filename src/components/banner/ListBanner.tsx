import { useEffect, useRef, useState } from 'react'
import { getSetting, setSetting } from '../../db/settings'
import { backupReminder, backupReminderText, deviceKind, pickBanner, showInstallGuide, type DeviceKind } from '../../lib/banners'
import { isStandalone } from '../../lib/homeScreenGuide'
import { nowIso } from '../../lib/time'
import { applyUpdate, useUpdateAvailable } from '../../pwa/updateStore'
import { InstallGuideSheet } from './InstallGuideSheet'
import { UpdateBar } from './UpdateBar'
import './banner.css'

interface Props {
  /** Shops on this device (both tabs); only meaningful when `ready`. */
  shopCount: number
  ready: boolean
  selecting: boolean
  onOpenData: () => void
}

interface Stored {
  lastBackupAt?: string
  firstShopAt?: string
  backupReminderDismissedAt?: string
  installGuideDismissedAt?: string
}

/**
 * The one thin bar between the list's top bar and the tabs (construction 9, spec 4.6):
 * update -> "add to home screen" guide -> backup reminder. None while selecting shops.
 */
export function ListBanner({ shopCount, ready, selecting, onOpenData }: Props) {
  const update = useUpdateAvailable()
  const [stored, setStored] = useState<Stored>()
  const [device] = useState<DeviceKind>(() => deviceKind({ userAgent: navigator.userAgent, maxTouchPoints: navigator.maxTouchPoints ?? 0 }))
  const [standalone] = useState(isStandalone)
  const [guideOpen, setGuideOpen] = useState(false)
  const firstShopRecorded = useRef(false)

  useEffect(() => {
    let active = true
    Promise.all([getSetting('lastBackupAt'), getSetting('firstShopAt'), getSetting('backupReminderDismissedAt'), getSetting('installGuideDismissedAt')]).then(
      ([lastBackupAt, firstShopAt, backupReminderDismissedAt, installGuideDismissedAt]) => {
        if (active) setStored({ lastBackupAt, firstShopAt, backupReminderDismissedAt, installGuideDismissedAt })
      },
    )
    return () => {
      active = false
    }
  }, [])

  // the first time this device shows a shop in the list: the base date of the reminder (only
  // stored; "now" gives 0 days, so it changes nothing on screen until the next visit)
  useEffect(() => {
    if (!ready || !stored || stored.firstShopAt || shopCount === 0 || firstShopRecorded.current) return
    firstShopRecorded.current = true
    void setSetting('firstShopAt', nowIso())
  }, [ready, stored, shopCount])

  if (!ready || !stored) return null
  const reminder = backupReminder({ shopCount, ...stored, dismissedAt: stored.backupReminderDismissedAt, nowMs: Date.parse(nowIso()) })
  const install = showInstallGuide({ device, standalone, dismissedAt: stored.installGuideDismissedAt })
  const kind = pickBanner({ selecting, update, install, backup: reminder.show })

  const dismiss = (key: 'backupReminderDismissedAt' | 'installGuideDismissedAt') => {
    const at = nowIso()
    void setSetting(key, at)
    setStored((s) => (s ? { ...s, [key]: at } : s))
  }

  return (
    <>
      {kind === 'update' && <UpdateBar onUpdate={applyUpdate} />}
      {kind === 'install' && (
        <div className="app-banner" role="status" data-banner="install">
          <button type="button" className="app-banner-main" onClick={() => setGuideOpen(true)}>
            ホーム画面に追加するとアプリとして使えます
            <span className="app-banner-go" aria-hidden="true">
              ›
            </span>
          </button>
          <button type="button" className="app-banner-close" aria-label="閉じる" onClick={() => dismiss('installGuideDismissedAt')}>
            ×
          </button>
        </div>
      )}
      {kind === 'backup' && reminder.show && (
        <div className="app-banner" role="status" data-banner="backup">
          <span className="app-banner-text">{backupReminderText(reminder)}</span>
          <button type="button" className="app-banner-action" onClick={onOpenData}>
            バックアップする
          </button>
          <button type="button" className="app-banner-close" aria-label="閉じる" onClick={() => dismiss('backupReminderDismissedAt')}>
            ×
          </button>
        </div>
      )}
      {guideOpen && device !== 'other' && (
        <InstallGuideSheet
          device={device}
          hasShops={shopCount > 0}
          onClose={() => setGuideOpen(false)}
          onOpenData={() => {
            setGuideOpen(false)
            onOpenData()
          }}
        />
      )}
    </>
  )
}
