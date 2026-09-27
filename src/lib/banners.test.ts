import { describe, expect, it } from 'vitest'
import { backupReminder, backupReminderText, daysSince, deviceKind, pickBanner, showInstallGuide } from './banners'

const NOW = Date.parse('2026-10-31T12:00:00.000Z')
const ago = (days: number, extraMs = 0) => new Date(NOW - days * 86_400_000 - extraMs).toISOString()

describe('backup reminder', () => {
  it('days: elapsed / 24h, rounded down', () => {
    expect(daysSince(ago(30), NOW)).toBe(30)
    expect(daysSince(ago(30, -1), NOW)).toBe(29) // 1 ms short of 30 days
    expect(daysSince(ago(0), NOW)).toBe(0)
    expect(daysSince(undefined, NOW)).toBeUndefined()
    expect(daysSince('broken', NOW)).toBeUndefined()
  })

  it('29 days: no; 30 days: yes (from the last backup)', () => {
    expect(backupReminder({ shopCount: 1, lastBackupAt: ago(29), nowMs: NOW })).toEqual({ show: false })
    expect(backupReminder({ shopCount: 1, lastBackupAt: ago(30), nowMs: NOW })).toEqual({ show: true, days: 30, never: false })
    expect(backupReminder({ shopCount: 1, lastBackupAt: ago(30, -1), nowMs: NOW })).toEqual({ show: false })
  })

  it('the last backup wins over firstShopAt; without a backup, firstShopAt is the base; neither: no', () => {
    // backed up 10 days ago, first shop 100 days ago -> no
    expect(backupReminder({ shopCount: 3, lastBackupAt: ago(10), firstShopAt: ago(100), nowMs: NOW }).show).toBe(false)
    expect(backupReminder({ shopCount: 3, firstShopAt: ago(31), nowMs: NOW })).toEqual({ show: true, days: 31, never: true })
    expect(backupReminder({ shopCount: 3, firstShopAt: ago(29), nowMs: NOW }).show).toBe(false)
    expect(backupReminder({ shopCount: 3, nowMs: NOW }).show).toBe(false)
  })

  it('no shop: no', () => {
    expect(backupReminder({ shopCount: 0, lastBackupAt: ago(90), firstShopAt: ago(90), nowMs: NOW }).show).toBe(false)
  })

  it('× : not shown for 7 days (6 days: no, 7 days: yes again)', () => {
    const base = { shopCount: 1, lastBackupAt: ago(60), nowMs: NOW }
    expect(backupReminder({ ...base, dismissedAt: ago(6) }).show).toBe(false)
    expect(backupReminder({ ...base, dismissedAt: ago(7, -1) }).show).toBe(false)
    expect(backupReminder({ ...base, dismissedAt: ago(7) })).toEqual({ show: true, days: 60, never: false })
  })

  it('text', () => {
    expect(backupReminderText({ days: 32, never: false })).toBe('最後のバックアップから32日たちました')
    expect(backupReminderText({ days: 45, never: true })).toBe('まだバックアップしていません')
  })
})

describe('device and the install guide', () => {
  const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1'
  const IPAD = 'Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1'
  const MAC = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15'
  const ANDROID = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Mobile Safari/537.36'
  const WINDOWS = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36'

  it('iPhone / iPad / iPad that says Macintosh (touch) / Mac / Android / PC', () => {
    expect(deviceKind({ userAgent: IPHONE, maxTouchPoints: 5 })).toBe('ios')
    expect(deviceKind({ userAgent: IPAD, maxTouchPoints: 5 })).toBe('ios')
    expect(deviceKind({ userAgent: MAC, maxTouchPoints: 5 })).toBe('ios')
    expect(deviceKind({ userAgent: MAC, maxTouchPoints: 0 })).toBe('other')
    expect(deviceKind({ userAgent: ANDROID, maxTouchPoints: 5 })).toBe('android')
    expect(deviceKind({ userAgent: WINDOWS, maxTouchPoints: 0 })).toBe('other')
  })

  it('shown only in a phone browser, not in the home screen app, never after ×', () => {
    expect(showInstallGuide({ device: 'ios', standalone: false })).toBe(true)
    expect(showInstallGuide({ device: 'android', standalone: false })).toBe(true)
    expect(showInstallGuide({ device: 'other', standalone: false })).toBe(false)
    expect(showInstallGuide({ device: 'ios', standalone: true })).toBe(false)
    expect(showInstallGuide({ device: 'ios', standalone: false, dismissedAt: ago(400) })).toBe(false)
  })
})

describe('one bar at a time', () => {
  it('update -> install -> backup; nothing while selecting', () => {
    const all = { selecting: false, update: true, install: true, backup: true }
    expect(pickBanner(all)).toBe('update')
    expect(pickBanner({ ...all, update: false })).toBe('install')
    expect(pickBanner({ ...all, update: false, install: false })).toBe('backup')
    expect(pickBanner({ ...all, update: false, install: false, backup: false })).toBeUndefined()
    expect(pickBanner({ ...all, selecting: true })).toBeUndefined()
  })
})
