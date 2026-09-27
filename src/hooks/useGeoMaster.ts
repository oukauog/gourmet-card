import { useEffect, useState } from 'react'
import { loadCities, loadedCities, loadedStationMaster, loadStationMaster } from '../data/geoMaster'
import type { CityMap, StationMaster } from '../lib/geo'

export type Loadable<T> = { state: 'idle' } | { state: 'loading' } | { state: 'ready'; value: T } | { state: 'error' }

/** Loads once while `enabled`; an already loaded master is ready on the first render (no flash). */
function useLoad<T>(enabled: boolean, loaded: () => T | undefined, load: () => Promise<T>): Loadable<T> {
  const [, setDone] = useState(0)
  const [failed, setFailed] = useState(false)
  useEffect(() => {
    if (!enabled || loaded()) return
    let active = true
    load().then(
      () => active && setDone((n) => n + 1),
      (e) => {
        console.error(e)
        if (active) setFailed(true)
      },
    )
    return () => {
      active = false
    }
  }, [enabled, loaded, load])
  const value = loaded()
  if (value) return { state: 'ready', value }
  if (!enabled) return { state: 'idle' }
  return failed ? { state: 'error' } : { state: 'loading' }
}

/** The station master, loaded only while `enabled` (e.g. some shop has a station). */
export const useStationMaster = (enabled: boolean) => useLoad<StationMaster>(enabled, loadedStationMaster, loadStationMaster)
export const useCities = (enabled: boolean) => useLoad<CityMap>(enabled, loadedCities, loadCities)
