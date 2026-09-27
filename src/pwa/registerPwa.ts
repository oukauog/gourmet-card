// Service worker registration (construction 9, spec 4.6). Only in the build: the dev server and
// the e2e tests never register one. Update check: when the app opens, and when it comes back to
// the screen (visibilitychange; at most once a minute), because an iPhone home screen app is
// rarely closed. A new version is only announced (updateStore); it is applied when tapped.
import { setUpdateReady } from './updateStore'

const CHECK_INTERVAL_MS = 60_000

export function startPwa(): void {
  if (import.meta.env.PROD) {
    if (!('serviceWorker' in navigator)) return
    void import('virtual:pwa-register').then(({ registerSW }) => {
      const updateSW = registerSW({
        immediate: true,
        onNeedRefresh: () => setUpdateReady(() => void updateSW(true)),
        onRegisteredSW: (_url, registration) => {
          if (!registration) return
          let lastCheck = Date.now()
          document.addEventListener('visibilitychange', () => {
            if (document.visibilityState !== 'visible' || Date.now() - lastCheck < CHECK_INTERVAL_MS) return
            lastCheck = Date.now()
            void registration.update().catch(() => undefined)
          })
        },
      })
    })
  } else if (import.meta.env.DEV) {
    // DEV only: a way to make "a new version is ready" for checking the bar (never in the build)
    void import('./devFakeUpdate').then((m) => m.installDevFakeUpdate())
  }
}
