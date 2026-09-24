import { db } from './db'
import { ValidationError } from './errors'
import { SORT_ORDERS, type SettingKey, type SettingsMap, type SortOrder } from './types'

const VALIDATORS: { [K in SettingKey]: (v: unknown) => v is SettingsMap[K] } = {
  lastBackupAt: (v): v is string => typeof v === 'string' && !Number.isNaN(Date.parse(v)),
  sortOrder: (v): v is SortOrder => SORT_ORDERS.includes(v as SortOrder),
  columns: (v): v is 2 | 3 => v === 2 || v === 3,
}

/** Stored value of the setting, or undefined if never set. */
export async function getSetting<K extends SettingKey>(key: K): Promise<SettingsMap[K] | undefined> {
  const row = await db.settings.get(key)
  return row?.value as SettingsMap[K] | undefined
}

/** Store a setting. Throws ValidationError for an unknown key or a value of the wrong type. */
export async function setSetting<K extends SettingKey>(key: K, value: SettingsMap[K]): Promise<void> {
  const validate = VALIDATORS[key] as ((v: unknown) => boolean) | undefined
  if (!validate) throw new ValidationError(`unknown setting key: ${String(key)}`)
  if (!validate(value)) throw new ValidationError(`invalid value for ${key}: ${String(value)}`)
  await db.settings.put({ key, value })
}
