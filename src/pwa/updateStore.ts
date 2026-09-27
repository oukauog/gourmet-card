// "新しい版があります［更新］" (construction 9, spec 4.6): whether a new version is ready, and the
// function that switches to it. Filled by registerPwa.ts (build) or the DEV fake; screens read it
// with useUpdateAvailable().
import { useSyncExternalStore } from 'react'

type Updater = () => void

let ready = false
let updater: Updater | undefined
const listeners = new Set<() => void>()

/** A new version is waiting; `update` reloads the app with it (never called automatically). */
export function setUpdateReady(update: Updater): void {
  ready = true
  updater = update
  for (const l of listeners) l()
}

/** Switch to the new version (the bar's button). */
export function applyUpdate(): void {
  updater?.()
}

function subscribe(l: () => void) {
  listeners.add(l)
  return () => listeners.delete(l)
}

export function useUpdateAvailable(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => ready,
    () => false,
  )
}
