import { useEffect, useState } from 'react'
import { loadCities, loadedCities, loadedStationMaster, loadStationMaster } from '../data/geoMaster'
import type { CityMap, StationMaster } from '../lib/geo'

export type Loadable<T> = { state: 'idle' } | { state: 'loading' } | { state: 'ready'; value: T } | { state: 'error' }

function useLoad<T>(enabled: boolean, loaded: () => T | undefined, load: () => Promise<T>): Loadable<T> {
  const [result, setResult] = useState<Loadable<T>>(() => {
    const v = loaded()
    return v ? { state: 'ready', value: v } : { state: enabled ? 'loading' : 'idle' }
  })
  useEffect(() => {
    if (!enabled) return
    const v = loaded()
    if (v) {
      setResult({ state: 'ready', value: v })
      return
    }
    let active = true
    setResult({ state: 'loading' })
    load().then(
      (value) => active && setResult({ state: 'ready', value }),
      (e) => {
        console.error(e)
        if (active) setResult({ state: 'error' })
      },
    )
    return () => {
      active = false
    }
  }, [enabled, loaded, load])
  return result
}

/** The station master, loaded only while `enabled` (e.g. some shop has a station). */
export const useStationMaster = (enabled: boolean) => useLoad<StationMaster>(enabled, loadedStationMaster, loadStationMaster)
export const useCities = (enabled: boolean) => useLoad<CityMap>(enabled, loadedCities, loadCities)
