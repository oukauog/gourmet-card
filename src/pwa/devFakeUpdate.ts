// DEV ONLY (imported only when import.meta.env.DEV; not in the build): e2e / manual checks call
// window.__gourmetDevFakeUpdate() to pretend a new version is ready. Tapping "更新" then only
// counts in window.__gourmetDevUpdateCalls (no reload).
import { setUpdateReady } from './updateStore'

interface DevWindow {
  __gourmetDevFakeUpdate?: () => void
  __gourmetDevUpdateCalls?: number
}

export function installDevFakeUpdate(): void {
  const w = window as unknown as DevWindow
  w.__gourmetDevUpdateCalls = 0
  w.__gourmetDevFakeUpdate = () =>
    setUpdateReady(() => {
      w.__gourmetDevUpdateCalls = (w.__gourmetDevUpdateCalls ?? 0) + 1
    })
}
