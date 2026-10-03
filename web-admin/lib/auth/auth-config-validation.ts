/**
 * Auth config value validation (pure; client + server safe).
 *
 * Mirrors the database rule `fn_auth_cfg_value_ok` (migration 0570) so the API and the UI reject bad
 * input with a clear message before the DB trigger would. The DB remains authoritative.
 */

import { AUTH_CONFIG_VALUE_TYPES } from '@/lib/constants/auth-admin-config'
import type {
  AuthConfigInputValue,
  AuthConfigItem,
  AuthConfigValidation,
} from '@/lib/types/auth-admin-config'

/** Digits only, optional minus, max 9 digits — same pattern as the DB validator. */
const INTEGER_TEXT = /^-?[0-9]{1,9}$/

/**
 * Validate and normalise a raw value for a catalog item.
 *
 * @param item - Catalog item with type and bounds
 * @param raw - Raw value from the form/API (string, number or boolean)
 * @returns `{ ok: true, value }` with the text form to store, or `{ ok: false, reason }`
 */
export function validateAuthConfigValue(
  item: Pick<AuthConfigItem, 'valueType' | 'minValue' | 'maxValue' | 'allowedValues'>,
  raw: AuthConfigInputValue
): AuthConfigValidation {
  if (item.valueType === AUTH_CONFIG_VALUE_TYPES.INTEGER) {
    const text = typeof raw === 'number' ? String(raw) : typeof raw === 'string' ? raw.trim() : ''
    if (!INTEGER_TEXT.test(text)) return { ok: false, reason: 'type' }
    const n = Number(text)
    if ((item.minValue !== null && n < item.minValue) || (item.maxValue !== null && n > item.maxValue)) {
      return { ok: false, reason: 'range' }
    }
    return { ok: true, value: String(n) }
  }

  if (item.valueType === AUTH_CONFIG_VALUE_TYPES.BOOLEAN) {
    if (typeof raw === 'boolean') return { ok: true, value: raw ? 'true' : 'false' }
    if (raw === 'true' || raw === 'false') return { ok: true, value: raw }
    return { ok: false, reason: 'type' }
  }

  // ENUM
  if (typeof raw !== 'string') return { ok: false, reason: 'type' }
  if (!item.allowedValues || !item.allowedValues.includes(raw)) return { ok: false, reason: 'not_allowed' }
  return { ok: true, value: raw }
}

/**
 * Convert a stored text value to its typed form.
 *
 * @param valueType - Item value type
 * @param value - Stored text value
 * @returns number for INTEGER, boolean for BOOLEAN, string for ENUM
 */
export function parseAuthConfigValue(
  valueType: AuthConfigItem['valueType'],
  value: string
): number | boolean | string {
  if (valueType === AUTH_CONFIG_VALUE_TYPES.INTEGER) return Number(value)
  if (valueType === AUTH_CONFIG_VALUE_TYPES.BOOLEAN) return value === 'true'
  return value
}
