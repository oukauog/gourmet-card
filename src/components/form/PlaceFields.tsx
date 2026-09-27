import { useEffect, useRef, useState } from 'react'
import { useCities, useStationMaster } from '../../hooks/useGeoMaster'
import {
  autofillPlace,
  citiesOf,
  findStation,
  isKanaOnly,
  MISSING_STATION_NAME,
  stationChoiceLabel,
  stationLabel,
  stationLocation,
  suggestStations,
  type Station,
} from '../../lib/geo'
import { PREFECTURES } from '../../lib/prefectures'
import '../../styles/station.css'

export interface PlaceValue {
  /** '' = not chosen (all three). */
  prefecture: string
  city: string
  stationId: string
}

interface Props {
  value: PlaceValue
  onChange: (next: PlaceValue) => void
}

/**
 * 最寄り駅 -> 県 -> 市 (spec 4.2.2). Picking a station fills an empty prefecture / city (never
 * overwrites). Changing the prefecture clears the city (not the station). The masters are read
 * when the form opens; if they fail, the rest of the form still works.
 */
export function PlaceFields({ value, onChange }: Props) {
  const master = useStationMaster(true)
  const cities = useCities(true)
  const { prefecture, city } = value

  const pickStation = (s: Station) => onChange({ ...autofillPlace({ prefecture, city }, s), stationId: s.id })
  const changePrefecture = (p: string) => onChange({ ...value, prefecture: p, city: p === prefecture ? city : '' })

  // keep values that are not in the lists (e.g. sample data / imports) selectable, first
  const prefectures = prefecture && !PREFECTURES.includes(prefecture) ? [prefecture, ...PREFECTURES] : PREFECTURES
  const cityList = cities.state === 'ready' ? citiesOf(cities.value, prefecture) : []
  const cityOptions = city && !cityList.includes(city) ? [city, ...cityList] : cityList
  const cityDisabled = prefecture === '' && city === ''

  return (
    <>
      <StationField
        stationId={value.stationId}
        prefecture={prefecture}
        master={master}
        onPick={pickStation}
        onClear={() => onChange({ ...value, stationId: '' })}
      />

      <div className="form-field">
        <label className="form-label" htmlFor="form-prefecture">
          県
        </label>
        <select id="form-prefecture" className="text-input form-select" value={prefecture} onChange={(e) => changePrefecture(e.target.value)}>
          <option value="">未選択</option>
          {prefectures.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>
      </div>

      <div className="form-field">
        <label className="form-label" htmlFor="form-city">
          市
        </label>
        <select
          id="form-city"
          className="text-input form-select"
          value={city}
          disabled={cityDisabled}
          onChange={(e) => onChange({ ...value, city: e.target.value })}
        >
          <option value="">選択しない</option>
          {cityOptions.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </div>
    </>
  )
}

type MasterState = ReturnType<typeof useStationMaster>

interface StationFieldProps {
  stationId: string
  prefecture: string
  master: MasterState
  onPick: (s: Station) => void
  onClear: () => void
}

function StationField({ stationId, prefecture, master, onPick, onClear }: StationFieldProps) {
  const [text, setText] = useState('')
  const [open, setOpen] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const closeTimer = useRef<ReturnType<typeof setTimeout>>(undefined)
  const scrollTimer = useRef<ReturnType<typeof setTimeout>>(undefined)
  useEffect(
    () => () => {
      clearTimeout(closeTimer.current)
      clearTimeout(scrollTimer.current)
    },
    [],
  )

  const ready = master.state === 'ready' ? master.value : undefined
  const candidates = ready && open ? suggestStations(ready, text, prefecture) : []

  if (stationId !== '') {
    const s = ready ? findStation(ready, stationId) : undefined
    const name = s ? stationLabel(s) : ready ? MISSING_STATION_NAME : master.state === 'error' ? MISSING_STATION_NAME : '読み込み中…'
    return (
      <div className="form-field">
        <span className="form-label" id="form-station-label">
          最寄り駅
        </span>
        <div className="station-chosen" role="group" aria-labelledby="form-station-label">
          <span className="station-chosen-name" data-testid="station-chosen">
            {name}
          </span>
          <button type="button" className="tag-chip-remove" aria-label="最寄り駅を外す" onClick={onClear}>
            ×
          </button>
        </div>
      </div>
    )
  }

  const disabled = master.state !== 'ready'
  const placeholder = master.state === 'error' ? '駅の一覧を読み込めませんでした' : disabled ? '読み込み中…' : '例: 富山'
  const q = text.trim()

  return (
    <div className="form-field">
      <label className="form-label" htmlFor="form-station">
        最寄り駅
      </label>
      <input
        ref={inputRef}
        id="form-station"
        className="text-input station-input"
        type="text"
        placeholder={placeholder}
        disabled={disabled}
        enterKeyHint="done"
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="off"
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') e.preventDefault() // never submit the form from here
        }}
        onFocus={() => {
          clearTimeout(closeTimer.current)
          setOpen(true)
          // bring the field to the top so the candidates are above the iPhone keyboard
          clearTimeout(scrollTimer.current)
          scrollTimer.current = setTimeout(() => inputRef.current?.scrollIntoView({ block: 'start', behavior: 'smooth' }), 300)
        }}
        // a short delay so that tapping a candidate still counts
        onBlur={() => {
          closeTimer.current = setTimeout(() => setOpen(false), 200)
        }}
      />
      {open && q !== '' && ready && (
        <StationCandidates
          list={candidates}
          text={q}
          labelOf={(s) => stationChoiceLabel(ready, s)}
          onPick={(s) => {
            setText('')
            setOpen(false)
            onPick(s)
          }}
        />
      )}
    </div>
  )
}

function StationCandidates({ list, text, labelOf, onPick }: { list: Station[]; text: string; labelOf: (s: Station) => string; onPick: (s: Station) => void }) {
  if (list.length === 0) {
    return <p className="form-hint station-none">{isKanaOnly(text) ? '漢字で入力すると候補が出ます' : '候補がありません'}</p>
  }
  return (
    <div className="station-list" role="group" aria-label="最寄り駅の候補">
      {list.map((s) => (
        <button
          key={s.id}
          type="button"
          className="station-candidate"
          // keep the focus in the field until the tap is done (like the tag candidates)
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => onPick(s)}
        >
          <span className="station-candidate-name">{labelOf(s)}</span>
          <span className="station-candidate-place">{stationLocation(s)}</span>
        </button>
      ))}
    </div>
  )
}
