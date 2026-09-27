import { versionText } from '../../lib/version'

// __APP_BUILD__ is replaced at build time (vite.config.ts); guarded in case it is not defined
const BUILD = typeof __APP_BUILD__ === 'undefined' ? undefined : __APP_BUILD__

/** Which build is running (construction 8p). Under the data credits, same small grey text. */
export function VersionLine() {
  return (
    <p className="geo-credits app-version" data-testid="app-version">
      {versionText(BUILD)}
    </p>
  )
}
