/**
 * Auth config value validation — mirrors DB fn_auth_cfg_value_ok (migration 0570).
 */

import { parseAuthConfigValue, validateAuthConfigValue } from '@/lib/auth/auth-config-validation'
import type { AuthConfigItem } from '@/lib/types/auth-admin-config'

type Shape = Pick<AuthConfigItem, 'valueType' | 'minValue' | 'maxValue' | 'allowedValues'>

const idleTimeout: Shape = { valueType: 'INTEGER', minValue: 0, maxValue: 480, allowedValues: null }
const alert: Shape = { valueType: 'BOOLEAN', minValue: null, maxValue: null, allowedValues: null }
const policy: Shape = {
  valueType: 'ENUM',
  minValue: null,
  maxValue: null,
  allowedValues: ['REVOKE_OLDEST', 'BLOCK_NEW'],
}

describe('validateAuthConfigValue — INTEGER', () => {
  it('accepts in-range numbers and numeric strings, normalising to text', () => {
    expect(validateAuthConfigValue(idleTimeout, 30)).toEqual({ ok: true, value: '30' })
    expect(validateAuthConfigValue(idleTimeout, ' 45 ')).toEqual({ ok: true, value: '45' })
    expect(validateAuthConfigValue(idleTimeout, 0)).toEqual({ ok: true, value: '0' })
    expect(validateAuthConfigValue(idleTimeout, 480)).toEqual({ ok: true, value: '480' })
  })

  it('rejects out-of-range values', () => {
    expect(validateAuthConfigValue(idleTimeout, 481)).toEqual({ ok: false, reason: 'range' })
    expect(validateAuthConfigValue(idleTimeout, -1)).toEqual({ ok: false, reason: 'range' })
  })

  it('rejects non-integers and non-numeric input', () => {
    for (const bad of ['abc', '1.5', '', '12e3', '1_0', true as unknown as string]) {
      expect(validateAuthConfigValue(idleTimeout, bad).ok).toBe(false)
    }
    expect(validateAuthConfigValue(idleTimeout, 1.5)).toEqual({ ok: false, reason: 'type' })
  })
})

describe('validateAuthConfigValue — BOOLEAN', () => {
  it('accepts booleans and the strings true/false', () => {
    expect(validateAuthConfigValue(alert, true)).toEqual({ ok: true, value: 'true' })
    expect(validateAuthConfigValue(alert, false)).toEqual({ ok: true, value: 'false' })
    expect(validateAuthConfigValue(alert, 'true')).toEqual({ ok: true, value: 'true' })
  })

  it('rejects anything else', () => {
    expect(validateAuthConfigValue(alert, 'yes')).toEqual({ ok: false, reason: 'type' })
    expect(validateAuthConfigValue(alert, 1)).toEqual({ ok: false, reason: 'type' })
  })
})

describe('validateAuthConfigValue — ENUM', () => {
  it('accepts an allowed member', () => {
    expect(validateAuthConfigValue(policy, 'BLOCK_NEW')).toEqual({ ok: true, value: 'BLOCK_NEW' })
  })

  it('rejects unknown members and wrong types', () => {
    expect(validateAuthConfigValue(policy, 'block_new')).toEqual({ ok: false, reason: 'not_allowed' })
    expect(validateAuthConfigValue(policy, 3)).toEqual({ ok: false, reason: 'type' })
  })
})

describe('parseAuthConfigValue', () => {
  it('returns typed values', () => {
    expect(parseAuthConfigValue('INTEGER', '30')).toBe(30)
    expect(parseAuthConfigValue('BOOLEAN', 'true')).toBe(true)
    expect(parseAuthConfigValue('BOOLEAN', 'false')).toBe(false)
    expect(parseAuthConfigValue('ENUM', 'REVOKE_OLDEST')).toBe('REVOKE_OLDEST')
  })
})
