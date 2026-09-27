// The ONE place for the extension and MIME type of the card file (spec 4.5.2 / 5).
// Construction 8 tries both on real iPhones (trial switch on the data screen); construction 8a
// keeps one of them: delete the other entry here and the trial switch
// (src/components/share/FileTypeTrial.tsx).

export const CARD_FILE_TYPES = {
  gcard: { extension: '.gcard', mime: 'application/octet-stream' },
  zip: { extension: '.zip', mime: 'application/zip' },
} as const

export type CardFileTypeKey = keyof typeof CARD_FILE_TYPES
export type CardFileType = (typeof CARD_FILE_TYPES)[CardFileTypeKey]

export const DEFAULT_CARD_FILE_TYPE: CardFileTypeKey = 'gcard'
