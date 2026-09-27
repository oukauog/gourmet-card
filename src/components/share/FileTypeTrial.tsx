// TRIAL ONLY (construction 8; removed in construction 8a): which extension to send, .gcard or
// .zip, to compare them on real iPhones. Everything about the trial is in this file: the stored
// choice (localStorage, per device; any failure falls back to .gcard) and the switch UI.
import { useState } from 'react'
import { CARD_FILE_TYPES, DEFAULT_CARD_FILE_TYPE, type CardFileType, type CardFileTypeKey } from '../../lib/cardFileType'

const STORAGE_KEY = 'gourmet-card.trialFileType'

function readChoice(): CardFileTypeKey {
  try {
    const v = window.localStorage.getItem(STORAGE_KEY)
    return v === 'gcard' || v === 'zip' ? v : DEFAULT_CARD_FILE_TYPE
  } catch {
    return DEFAULT_CARD_FILE_TYPE
  }
}

function writeChoice(v: CardFileTypeKey): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, v)
  } catch {
    // not saved (private mode etc.): the choice lasts until the page is closed
  }
}

/** The extension / MIME type to write now. */
// kept in this file on purpose: the whole trial is removed at once in construction 8a
// oxlint-disable-next-line react/only-export-components
export const currentCardFileType = (): CardFileType => CARD_FILE_TYPES[readChoice()]

/** "送るファイルの形式（試験用）：● .gcard ○ .zip" */
export function FileTypeTrial() {
  const [value, setValue] = useState<CardFileTypeKey>(readChoice)
  const choose = (v: CardFileTypeKey) => {
    writeChoice(v)
    setValue(v)
  }
  return (
    <section className="data-section data-trial" aria-labelledby="data-trial-title">
      <h2 className="data-trial-title" id="data-trial-title">
        送るファイルの形式（試験用）
      </h2>
      <div className="data-trial-options" role="radiogroup" aria-labelledby="data-trial-title">
        {(Object.keys(CARD_FILE_TYPES) as CardFileTypeKey[]).map((k) => (
          <button key={k} type="button" role="radio" aria-checked={value === k} className="option-chip" onClick={() => choose(k)}>
            {CARD_FILE_TYPES[k].extension}
          </button>
        ))}
      </div>
    </section>
  )
}
