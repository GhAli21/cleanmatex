/**
 * Sign-in identifier rules (email vs user_code). Mirrors DB constraint chk_org_users_user_code
 * (migration 0563) — if these expectations change, the migration and USER_CODE_REGEX must too.
 */

import {
  classifyLoginIdentifier,
  normalizeLoginIdentifier,
  validateLoginIdentifier,
} from '@/lib/auth/login-identifier'
import { USER_CODE_REGEX } from '@/lib/constants/auth-user'

describe('classifyLoginIdentifier', () => {
  it('treats anything with @ as an email', () => {
    expect(classifyLoginIdentifier('admin@demo-laundry.example')).toBe('email')
    expect(classifyLoginIdentifier('not-an-email@')).toBe('email')
  })

  it('treats everything else as a user code', () => {
    expect(classifyLoginIdentifier('U000123')).toBe('user_code')
    expect(classifyLoginIdentifier('cashier.1')).toBe('user_code')
  })
})

describe('normalizeLoginIdentifier', () => {
  it('trims whitespace but preserves case', () => {
    expect(normalizeLoginIdentifier('  U000123  ')).toBe('U000123')
    expect(normalizeLoginIdentifier('MixedCase')).toBe('MixedCase')
  })
})

describe('validateLoginIdentifier', () => {
  it('requires a value', () => {
    expect(validateLoginIdentifier('')).toBe('required')
    expect(validateLoginIdentifier('   ')).toBe('required')
  })

  it('accepts valid emails and rejects malformed ones', () => {
    expect(validateLoginIdentifier('name@company.com')).toBeUndefined()
    expect(validateLoginIdentifier('name@company')).toBe('invalid_email')
    expect(validateLoginIdentifier('@company.com')).toBe('invalid_email')
  })

  it('accepts valid user codes', () => {
    for (const code of ['U000001', 'abc', 'a.b-c_d', 'A'.repeat(30)]) {
      expect(validateLoginIdentifier(code)).toBeUndefined()
    }
  })

  it('rejects invalid user codes', () => {
    for (const code of ['ab', 'A'.repeat(31), '.abc', '-abc', 'has space', 'bad!char']) {
      expect(validateLoginIdentifier(code)).toBe('invalid_user_code')
    }
  })
})

describe('USER_CODE_REGEX', () => {
  it('can never match an email (no @ allowed)', () => {
    expect(USER_CODE_REGEX.test('user@host.com')).toBe(false)
  })
})
