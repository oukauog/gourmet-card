// The one bar above the list (construction 9, spec 4.6). Pure: every input is passed in.
//   priority: update -> install guide -> backup reminder; nothing while selecting shops

const DAY_MS = 24 * 60 * 60 * 1000
export const BACKUP_REMINDER_DAYS = 30
export const BACKUP_REMINDER_SNOOZE_DAYS = 7

/** Whole days from `iso` to `nowMs` (elapsed time / 24 h, rounded down). undefined for a broken date. */
export function daysSince(iso: string | undefined, nowMs: number): number | undefined {
  if (!iso) return undefined
  const t = Date.parse(iso)
  if (Number.isNaN(t)) return undefined
  return Math.floor((nowMs - t) / DAY_MS)
}

export interface BackupReminderInput {
  shopCount: number
  lastBackupAt?: string
  /** When this device first saw a shop in the list. */
  firstShopAt?: string
  /** When × was tapped. */
  dismissedAt?: string
  nowMs: number
}

export type BackupReminder = { show: false } | { show: true; days: number; never: boolean }

/**
 * Shown when there is a shop and 30+ days passed since the last backup (or, never backed up, since
 * firstShopAt). Not within 7 days after ×. No base date at all: not shown.
 */
export function backupReminder(i: BackupReminderInput): BackupReminder {
  if (i.shopCount <= 0) return { show: false }
  const never = !i.lastBackupAt
  const days = daysSince(never ? i.firstShopAt : i.lastBackupAt, i.nowMs)
  if (days === undefined || days < BACKUP_REMINDER_DAYS) return { show: false }
  const snoozed = daysSince(i.dismissedAt, i.nowMs)
  if (snoozed !== undefined && snoozed < BACKUP_REMINDER_SNOOZE_DAYS) return { show: false }
  return { show: true, days, never }
}

/** "最後のバックアップから32日たちました" / "まだバックアップしていません". */
export function backupReminderText(r: { days: number; never: boolean }): string {
  return r.never ? 'まだバックアップしていません' : `最後のバックアップから${r.days}日たちました`
}

export type DeviceKind = 'ios' | 'android' | 'other'

export interface DeviceInput {
  userAgent: string
  maxTouchPoints: number
}

/** iPhone / iPad (also iPadOS that says "Macintosh" but has touch) / Android / other (PC). */
export function deviceKind({ userAgent, maxTouchPoints }: DeviceInput): DeviceKind {
  if (/iPhone|iPad|iPod/.test(userAgent)) return 'ios'
  if (/Macintosh/.test(userAgent) && maxTouchPoints > 1) return 'ios'
  if (/Android/.test(userAgent)) return 'android'
  return 'other'
}

export interface InstallGuideInput {
  device: DeviceKind
  /** display-mode: standalone, or navigator.standalone (iOS). */
  standalone: boolean
  dismissedAt?: string
}

/** Only in a phone's browser (not the home screen app, not a PC); never again after ×. */
export function showInstallGuide(i: InstallGuideInput): boolean {
  return i.device !== 'other' && !i.standalone && !i.dismissedAt
}

export type BannerKind = 'update' | 'install' | 'backup'

/** At most one bar: update -> install -> backup. None while selecting shops. */
export function pickBanner(i: { selecting: boolean; update: boolean; install: boolean; backup: boolean }): BannerKind | undefined {
  if (i.selecting) return undefined
  if (i.update) return 'update'
  if (i.install) return 'install'
  if (i.backup) return 'backup'
  return undefined
}
