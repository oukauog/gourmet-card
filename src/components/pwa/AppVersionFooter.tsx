import { versionText } from '../../lib/version'
import './pwa.css'

// __APP_BUILD__ is replaced at build time (vite.config.ts); undefined on the dev server
const BUILD = typeof __APP_BUILD__ === 'undefined' ? undefined : __APP_BUILD__

/** The version at the bottom of the data screen (construction 9; the form keeps its own line). */
export function AppVersionFooter() {
  return (
    <p className="app-version-footer" data-testid="data-version">
      {versionText(BUILD)}
    </p>
  )
}
