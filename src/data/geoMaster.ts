// Loads the station / municipality masters (construction 7) as separate files, only when needed
// (the first list screen never reads them). Each is loaded once and reused; a failed load is
// forgotten so the next call tries again.
import { buildCityMap, buildStationMaster, type CityMap, type CityTable, type StationMaster, type StationTable } from '../lib/geo'

let cities: Promise<CityMap> | undefined
let stations: Promise<StationMaster> | undefined
let stationsReady: StationMaster | undefined
let citiesReady: CityMap | undefined

const cityTable = () => import('./cities.json').then((m) => m.default as unknown as CityTable)

export function loadCities(): Promise<CityMap> {
  cities ??= cityTable().then(
    (t) => (citiesReady = buildCityMap(t)),
    (e) => {
      cities = undefined
      throw e
    },
  )
  return cities
}

export function loadStationMaster(): Promise<StationMaster> {
  stations ??= Promise.all([import('./stations.json').then((m) => m.default as unknown as StationTable), cityTable()]).then(
    ([s, c]) => (stationsReady = buildStationMaster(s, c)),
    (e) => {
      stations = undefined
      throw e
    },
  )
  return stations
}

/** Already loaded (so a screen can draw at once without a loading step). */
export const loadedStationMaster = (): StationMaster | undefined => stationsReady
export const loadedCities = (): CityMap | undefined => citiesReady
