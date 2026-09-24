// Normalized key for tag matching (spec 3.4).
// Treated as the same: full-width / half-width (NFKC), upper / lower case,
// leading / trailing spaces, runs of spaces.
// NOT treated as the same: hiragana vs katakana, long vowel mark differences
// (out of spec scope; handled by merging tags in the tag management screen).

export function normalizeTagKey(name: string): string {
  return name.normalize('NFKC').toLowerCase().trim().replace(/\s+/g, ' ')
}
