// The ONE place for the extension and MIME type of the card file (spec 4.5.2 / 5).
// Construction 8a fixed it to .zip (the trial of construction 8 found both candidates about the
// same on real iPhones). Importing never looks at the extension: ZIP + manifest.json decide, so
// the files written during construction 8 under the other extension still import.

export const CARD_FILE_TYPE = { extension: '.zip', mime: 'application/zip' } as const

export type CardFileType = typeof CARD_FILE_TYPE
