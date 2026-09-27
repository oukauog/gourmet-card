// Version line at the bottom of the form (construction 8p). Pure.

/** Embedded at build time by vite.config.ts; undefined on the dev server. */
export interface BuildInfo {
  /** Short commit hash, with "+" when the working tree had changes; "unknown" without git. */
  hash: string
  /** ISO 8601 UTC time of the build. */
  builtAt: string
}

/** "2026-09-27 21:05" in Japan time (UTC+9, no daylight saving). "" for a broken date. */
export function formatJst(iso: string): string {
  const t = Date.parse(iso)
  if (Number.isNaN(t)) return ''
  const d = new Date(t + 9 * 60 * 60 * 1000)
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getUTCFullYear()}-${p(d.getUTCMonth() + 1)}-${p(d.getUTCDate())} ${p(d.getUTCHours())}:${p(d.getUTCMinutes())}`
}

/** "版 d844c4f（2026-09-27 21:05）"; "開発版" on the dev server. */
export function versionText(info: BuildInfo | undefined): string {
  if (!info) return '開発版'
  const when = formatJst(info.builtAt)
  return when ? `版 ${info.hash}（${when}）` : `版 ${info.hash}`
}
