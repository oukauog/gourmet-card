import { applyUpdate, useUpdateAvailable } from '../../pwa/updateStore'
import { UpdateBar } from './UpdateBar'

/** The update bar on the "バックアップと取り込み" screen (only the update; construction 9). */
export function DataUpdateBar() {
  return useUpdateAvailable() ? <UpdateBar onUpdate={applyUpdate} /> : null
}
