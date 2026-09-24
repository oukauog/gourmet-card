import { useMemo, useSyncExternalStore } from 'react'
import { formatHash, parseHash, type Route } from './hashRoute'

// history.replaceState does not fire hashchange, so replaceRoute() announces itself with this.
const REPLACE_EVENT = 'gourmet:routereplace'

function subscribe(onChange: () => void): () => void {
  window.addEventListener('hashchange', onChange)
  window.addEventListener(REPLACE_EVENT, onChange)
  return () => {
    window.removeEventListener('hashchange', onChange)
    window.removeEventListener(REPLACE_EVENT, onChange)
  }
}

const getHash = () => window.location.hash

/** Current route from location.hash; re-renders on hashchange / replaceRoute. */
export function useHashRoute(): Route {
  const hash = useSyncExternalStore(subscribe, getHash)
  return useMemo(() => parseHash(hash), [hash])
}

/** Go to a route and PUSH a history entry (browser back / iPhone back swipe returns). */
export function navigate(route: Route): void {
  window.location.hash = formatHash(route)
}

/** Go to a route WITHOUT a history entry (e.g. after save, so back does not reopen the form). */
export function replaceRoute(route: Route): void {
  window.history.replaceState(window.history.state, '', formatHash(route))
  window.dispatchEvent(new Event(REPLACE_EVENT))
}
