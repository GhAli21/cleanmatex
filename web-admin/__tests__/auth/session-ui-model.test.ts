/**
 * Pure UI-model helpers of the auth-session feature: relative time formatting and new-password validation.
 */
import { formatRelativeTime } from '@features/auth-session/model/format-time'
import { validateNewPassword } from '@features/auth-session/model/password-form'

describe('formatRelativeTime', () => {
  const now = Date.parse('2026-10-08T12:00:00Z')
  it('reads under a minute as now', () => {
    expect(formatRelativeTime('2026-10-08T11:59:40Z', 'en', now)).toBe('now')
  })
  it('uses minutes, hours and days', () => {
    expect(formatRelativeTime('2026-10-08T11:55:00Z', 'en', now)).toBe('5 minutes ago')
    expect(formatRelativeTime('2026-10-08T09:00:00Z', 'en', now)).toBe('3 hours ago')
    expect(formatRelativeTime('2026-10-06T12:00:00Z', 'en', now)).toBe('2 days ago')
  })
  it('localizes to Arabic', () => {
    expect(formatRelativeTime('2026-10-08T11:55:00Z', 'ar', now)).not.toBe('5 minutes ago')
  })
})

describe('validateNewPassword', () => {
  it('rejects a weak password before checking the confirmation', () => {
    expect(validateNewPassword('short', 'different')).toBe('weak')
    expect(validateNewPassword('alllowercase1', 'alllowercase1')).toBe('weak')
  })
  it('rejects a mismatching confirmation', () => {
    expect(validateNewPassword('Str0ngPassw', 'Str0ngPassx')).toBe('mismatch')
  })
  it('accepts a strong matching password', () => {
    expect(validateNewPassword('Str0ngPassw', 'Str0ngPassw')).toBeUndefined()
  })
})
