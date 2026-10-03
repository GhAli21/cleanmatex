/**
 * Pure helpers of the session lifecycle: safe redirect, reason mapping, JWT claim reading, device label.
 *
 * @jest-environment node
 */

import { getSafeRedirectPath } from '@/lib/security/safe-redirect'
import {
  LOGIN_REASONS,
  SESSION_END_REASONS,
  loginReasonForEndReason,
} from '@/lib/constants/auth-session'
import { decodeJwtClaims, getSessionIdFromToken } from '@/lib/auth/jwt-claims'
import {
  UNKNOWN_DEVICE_LABEL,
  generateDeviceId,
  hashDeviceId,
  isValidDeviceId,
  parseDeviceLabel,
} from '@/lib/services/auth/session/domain/device'

describe('getSafeRedirectPath', () => {
  it('accepts internal absolute paths and keeps the query string', () => {
    expect(getSafeRedirectPath('/dashboard/orders')).toBe('/dashboard/orders')
    expect(getSafeRedirectPath('/dashboard/orders?status=ready&page=2')).toBe('/dashboard/orders?status=ready&page=2')
    expect(getSafeRedirectPath('/dashboard/orders#top')).toBe('/dashboard/orders#top')
  })

  it('rejects open-redirect attempts', () => {
    for (const bad of [
      'https://evil.example',
      'http://evil.example/dashboard',
      '//evil.example',
      '/\\evil.example',
      '/%2fevil.example',
      '/%5cevil.example',
      'javascript:alert(1)',
      'dashboard',
      '',
      '/dash\nboard',
    ]) {
      expect(getSafeRedirectPath(bad)).toBe('/dashboard')
    }
  })

  it('rejects auth pages (no redirect loops) and null input', () => {
    expect(getSafeRedirectPath('/login')).toBe('/dashboard')
    expect(getSafeRedirectPath('/login?redirect=/x')).toBe('/dashboard')
    expect(getSafeRedirectPath('/logout')).toBe('/dashboard')
    expect(getSafeRedirectPath('/reset-password')).toBe('/dashboard')
    expect(getSafeRedirectPath(null)).toBe('/dashboard')
    expect(getSafeRedirectPath(undefined)).toBe('/dashboard')
  })

  it('honours a custom fallback', () => {
    expect(getSafeRedirectPath('//evil', '/home')).toBe('/home')
  })
})

describe('loginReasonForEndReason', () => {
  it('maps every end reason to a login-page reason', () => {
    expect(loginReasonForEndReason(SESSION_END_REASONS.IDLE_TIMEOUT)).toBe(LOGIN_REASONS.IDLE_TIMEOUT)
    expect(loginReasonForEndReason(SESSION_END_REASONS.USER_REVOKED)).toBe(LOGIN_REASONS.REVOKED)
    expect(loginReasonForEndReason(SESSION_END_REASONS.ADMIN_REVOKED)).toBe(LOGIN_REASONS.REVOKED)
    expect(loginReasonForEndReason(SESSION_END_REASONS.PASSWORD_CHANGED)).toBe(LOGIN_REASONS.PASSWORD_CHANGED)
    expect(loginReasonForEndReason(SESSION_END_REASONS.SESSION_LIMIT)).toBe(LOGIN_REASONS.SESSION_LIMIT)
    expect(loginReasonForEndReason(SESSION_END_REASONS.USER_DEACTIVATED)).toBe(LOGIN_REASONS.DEACTIVATED)
    expect(loginReasonForEndReason(SESSION_END_REASONS.MEMBERSHIP_REMOVED)).toBe(LOGIN_REASONS.DEACTIVATED)
  })

  it('falls back to a generic expired message for everything else', () => {
    expect(loginReasonForEndReason(SESSION_END_REASONS.ABSOLUTE_TIMEOUT)).toBe(LOGIN_REASONS.SESSION_EXPIRED)
    expect(loginReasonForEndReason(SESSION_END_REASONS.SECURITY)).toBe(LOGIN_REASONS.SESSION_EXPIRED)
    expect(loginReasonForEndReason(null)).toBe(LOGIN_REASONS.SESSION_EXPIRED)
    expect(loginReasonForEndReason('SOMETHING_NEW')).toBe(LOGIN_REASONS.SESSION_EXPIRED)
  })
})

describe('jwt claims', () => {
  const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString('base64url')
  const token = (payload: object) => `${b64({ alg: 'HS256' })}.${b64(payload)}.sig`

  it('reads session_id and other claims', () => {
    const t = token({ sub: 'u1', session_id: '11111111-1111-1111-1111-111111111111', exp: 123 })
    expect(decodeJwtClaims(t)?.sub).toBe('u1')
    expect(getSessionIdFromToken(t)).toBe('11111111-1111-1111-1111-111111111111')
  })

  it('handles unicode payloads', () => {
    expect(decodeJwtClaims(token({ name: 'محمد' }))?.name).toBe('محمد')
  })

  it('returns null for malformed or empty tokens', () => {
    expect(decodeJwtClaims('garbage')).toBeNull()
    expect(decodeJwtClaims('a.!!!.c')).toBeNull()
    expect(decodeJwtClaims('')).toBeNull()
    expect(decodeJwtClaims(null)).toBeNull()
    expect(getSessionIdFromToken(token({ sub: 'u1' }))).toBeNull()
  })
})

describe('parseDeviceLabel', () => {
  const cases: Array<[string, string]> = [
    ['Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36', 'Chrome on Windows'],
    ['Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36 Edg/126.0.0.0', 'Edge on Windows'],
    ['Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15', 'Safari on macOS'],
    ['Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1', 'Safari on iOS'],
    ['Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36', 'Chrome on Android'],
    ['Mozilla/5.0 (X11; Linux x86_64; rv:127.0) Gecko/20100101 Firefox/127.0', 'Firefox on Linux'],
    ['Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36 OPR/111.0.0.0', 'Opera on Windows'],
  ]

  it.each(cases)('%s', (ua, expected) => {
    expect(parseDeviceLabel(ua)).toBe(expected)
  })

  it('falls back for missing or unknown agents', () => {
    expect(parseDeviceLabel(null)).toBe(UNKNOWN_DEVICE_LABEL)
    expect(parseDeviceLabel('')).toBe(UNKNOWN_DEVICE_LABEL)
    expect(parseDeviceLabel('curl/8.0')).toBe(UNKNOWN_DEVICE_LABEL)
  })
})

describe('device id', () => {
  it('generates valid, unique ids and a stable 64-char hash', async () => {
    const a = generateDeviceId()
    const b = generateDeviceId()
    expect(isValidDeviceId(a)).toBe(true)
    expect(a).not.toBe(b)
    const h1 = await hashDeviceId(a)
    expect(h1).toMatch(/^[0-9a-f]{64}$/)
    expect(await hashDeviceId(a)).toBe(h1)
    expect(await hashDeviceId(b)).not.toBe(h1)
  })

  it('rejects malformed cookie values', () => {
    for (const bad of ['', 'xyz', 'G'.repeat(32), 'a'.repeat(31), 'a'.repeat(33), null, undefined]) {
      expect(isValidDeviceId(bad as string | null | undefined)).toBe(false)
    }
  })
})
