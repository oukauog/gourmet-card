import type { DeviceKind } from '../../lib/banners'
import { INSTALL_STEPS, MOVE_SHOPS_NOTE } from '../../lib/homeScreenGuide'
import { BottomSheet } from '../filter/BottomSheet'
import '../../styles/filter.css'
import './banner.css'

interface Props {
  device: Exclude<DeviceKind, 'other'>
  hasShops: boolean
  onClose: () => void
  onOpenData: () => void
}

/** How to add the app to the home screen (construction 9, spec 4.6). */
export function InstallGuideSheet({ device, hasShops, onClose, onOpenData }: Props) {
  return (
    <BottomSheet title="ホーム画面に追加する" onClose={onClose}>
      <div className="install-guide">
        <p className="install-device">{device === 'ios' ? 'iPhone・iPad（Safari）' : 'Android（Chrome など）'}</p>
        <ol className="install-steps">
          {INSTALL_STEPS[device].map((s) => (
            <li key={s}>{s}</li>
          ))}
        </ol>
        {hasShops && (
          <>
            <p className="install-note">{MOVE_SHOPS_NOTE}</p>
            <button type="button" className="btn btn-secondary btn-block" onClick={onOpenData}>
              バックアップと取り込みへ
            </button>
          </>
        )}
      </div>
    </BottomSheet>
  )
}
