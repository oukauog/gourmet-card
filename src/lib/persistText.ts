// "最後に保護を求めた日時：9月28日 10:12・許可されませんでした" (construction 9a). Pure.
import type { PersistResult } from '../db/types'

export const PERSIST_RESULT_TEXT: Record<PersistResult, string> = {
  granted: '許可されました',
  denied: '許可されませんでした',
  error: '失敗しました',
}

/** "9月28日 10:12" in Japan time (UTC+9). "" for a broken date. */
export function jstMonthDayTime(iso: string): string {
  const t = Date.parse(iso)
  if (Number.isNaN(t)) return ''
  const d = new Date(t + 9 * 60 * 60 * 1000)
  return `${d.getUTCMonth() + 1}月${d.getUTCDate()}日 ${d.getUTCHours()}:${String(d.getUTCMinutes()).padStart(2, '0')}`
}

/** The line under "保護されていません" etc.; undefined when never asked. */
export function persistRecordLine(at: string | undefined, result: PersistResult | undefined): string | undefined {
  if (!at || !result) return undefined
  const when = jstMonthDayTime(at)
  return `最後に保護を求めた日時：${when ? `${when}・` : ''}${PERSIST_RESULT_TEXT[result]}`
}
