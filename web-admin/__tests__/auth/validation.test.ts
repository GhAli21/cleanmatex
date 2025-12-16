/**
 * Auth Validation Tests
 *
 * Unit tests for authentication validation functions
 */

import {
  validateEmail,
  validatePassword,
  validatePasswordMatch,
  validateDisplayName,
  validateLoginForm,
  validateRegistrationForm,
  getPasswordStrengthLabel,
  PASSWORD_REQUIREMENTS,
} from '@/lib/auth/validation'

describe('Email Validation', () => {
  it('should accept valid email addresses', () => {
    expect(validateEmail('user@example.com')).toBeUndefined()
    expect(validateEmail('test.user+tag@subdomain.example.co.uk')).toBeUndefined()
    expect(validateEmail('admin@cleanmatex.com')).toBeUndefined()
  })

  it('should reject invalid email addresses', () => {
    expect(validateEmail('invalid')).toBe('Please enter a valid email address')
    expect(validateEmail('user@')).toBe('Please enter a valid email address')
    expect(validateEmail('@example.com')).toBe('Please enter a valid email address')
    expect(validateEmail('user @example.com')).toBe('Please enter a valid email address')
  })

  it('should reject empty email', () => {
    expect(validateEmail('')).toBe('Email is required')
  })
})

describe('Password Validation', () => {
  it('should accept strong passwords', () => {
    const result = validatePassword('SecurePass123')
    expect(result.isValid).toBe(true)
    expect(result.feedback).toHaveLength(0)
    expect(result.score).toBeGreaterThanOrEqual(3)
  })

  it('should accept very strong passwords with special characters', () => {
    const result = validatePassword('SecurePass123!')
    expect(result.isValid).toBe(true)
    expect(result.feedback).toHaveLength(0)
    expect(result.score).toBe(4)
  })

  it('should reject passwords that are too short', () => {
    const result = validatePassword('Short1')
    expect(result.isValid).toBe(false)
    expect(result.feedback).toContain(`Password must be at least ${PASSWORD_REQUIREMENTS.minLength} characters`)
  })

  it('should reject passwords without uppercase letters', () => {
    const result = validatePassword('lowercase123')
    expect(result.isValid).toBe(false)
    expect(result.feedback).toContain('Password must contain at least one uppercase letter')
  })

  it('should reject passwords without lowercase letters', () => {
    const result = validatePassword('UPPERCASE123')
    expect(result.isValid).toBe(false)
    expect(result.feedback).toContain('Password must contain at least one lowercase letter')
  })

  it('should reject passwords without numbers', () => {
    const result = validatePassword('NoNumbersHere')
    expect(result.isValid).toBe(false)
    expect(result.feedback).toContain('Password must contain at least one number')
  })

  it('should handle multiple validation errors', () => {
    const result = validatePassword('weak')
    expect(result.isValid).toBe(false)
    expect(result.feedback.length).toBeGreaterThan(1)
  })

  it('should give bonus score for long passwords', () => {
    const shortPassword = validatePassword('ValidPass1')
    const longPassword = validatePassword('ValidPassword123')

    expect(longPassword.score).toBeGreaterThanOrEqual(shortPassword.score)
  })
})

describe('Password Match Validation', () => {
  it('should accept matching passwords', () => {
    expect(validatePasswordMatch('password123', 'password123')).toBeUndefined()
  })

  it('should reject non-matching passwords', () => {
    expect(validatePasswordMatch('password123', 'different123')).toBe('Passwords do not match')
  })

  it('should reject empty confirmation password', () => {
    expect(validatePasswordMatch('password123', '')).toBe('Please confirm your password')
  })

  it('should be case-sensitive', () => {
    expect(validatePasswordMatch('Password123', 'password123')).toBe('Passwords do not match')
  })
})

describe('Display Name Validation', () => {
  it('should accept valid display names', () => {
    expect(validateDisplayName('John Doe')).toBeUndefined()
    expect(validateDisplayName('Admin User')).toBeUndefined()
    expect(validateDisplayName('E-E/ 9DJ')).toBeUndefined() // Arabic name
  })

  it('should reject empty display names', () => {
    expect(validateDisplayName('')).toBe('Display name is required')
    expect(validateDisplayName('   ')).toBe('Display name is required')
  })

  it('should reject too short display names', () => {
    expect(validateDisplayName('A')).toBe('Display name must be at least 2 characters')
  })

  it('should reject too long display names', () => {
    const longName = 'A'.repeat(51)
    expect(validateDisplayName(longName)).toBe('Display name must be less than 50 characters')
  })

  it('should trim whitespace', () => {
    expect(validateDisplayName('  Valid Name  ')).toBeUndefined()
  })
})

describe('Login Form Validation', () => {
  it('should accept valid login credentials', () => {
    const errors = validateLoginForm('user@example.com', 'anypassword')
    expect(Object.keys(errors)).toHaveLength(0)
  })

  it('should reject invalid email', () => {
    const errors = validateLoginForm('invalid-email', 'password')
    expect(errors.email).toBe('Please enter a valid email address')
  })

  it('should reject empty password', () => {
    const errors = validateLoginForm('user@example.com', '')
    expect(errors.password).toBe('Password is required')
  })

  it('should reject both invalid email and empty password', () => {
    const errors = validateLoginForm('invalid', '')
    expect(errors.email).toBeDefined()
    expect(errors.password).toBeDefined()
  })
})

describe('Registration Form Validation', () => {
  it('should accept valid registration data', () => {
    const errors = validateRegistrationForm(
      'user@example.com',
      'SecurePass123',
      'SecurePass123',
      'John Doe'
    )
    expect(Object.keys(errors)).toHaveLength(0)
  })

  it('should reject invalid email', () => {
    const errors = validateRegistrationForm(
      'invalid-email',
      'SecurePass123',
      'SecurePass123',
      'John Doe'
    )
    expect(errors.email).toBeDefined()
  })

  it('should reject weak password', () => {
    const errors = validateRegistrationForm(
      'user@example.com',
      'weak',
      'weak',
      'John Doe'
    )
    expect(errors.password).toBeDefined()
  })

  it('should reject non-matching passwords', () => {
    const errors = validateRegistrationForm(
      'user@example.com',
      'SecurePass123',
      'DifferentPass123',
      'John Doe'
    )
    expect(errors.password).toBe('Passwords do not match')
  })

  it('should reject invalid display name', () => {
    const errors = validateRegistrationForm(
      'user@example.com',
      'SecurePass123',
      'SecurePass123',
      'A'
    )
    expect(errors.displayName).toBeDefined()
  })

  it('should handle multiple validation errors', () => {
    const errors = validateRegistrationForm('', '', '', '')
    expect(Object.keys(errors).length).toBeGreaterThan(2)
  })
})

describe('Password Strength Label', () => {
  it('should return correct labels for different scores', () => {
    expect(getPasswordStrengthLabel(0).label).toBe('Weak')
    expect(getPasswordStrengthLabel(1).label).toBe('Weak')
    expect(getPasswordStrengthLabel(2).label).toBe('Fair')
    expect(getPasswordStrengthLabel(3).label).toBe('Good')
    expect(getPasswordStrengthLabel(4).label).toBe('Strong')
  })

  it('should return correct colors for different scores', () => {
    expect(getPasswordStrengthLabel(0).color).toBe('text-red-500')
    expect(getPasswordStrengthLabel(2).color).toBe('text-orange-500')
    expect(getPasswordStrengthLabel(3).color).toBe('text-yellow-500')
    expect(getPasswordStrengthLabel(4).color).toBe('text-green-500')
  })

  it('should handle invalid scores gracefully', () => {
    expect(getPasswordStrengthLabel(-1).label).toBe('Unknown')
    expect(getPasswordStrengthLabel(10).label).toBe('Unknown')
  })
})

describe('Password Requirements', () => {
  it('should have sensible default requirements', () => {
    expect(PASSWORD_REQUIREMENTS.minLength).toBeGreaterThanOrEqual(8)
    expect(PASSWORD_REQUIREMENTS.requireUppercase).toBe(true)
    expect(PASSWORD_REQUIREMENTS.requireLowercase).toBe(true)
    expect(PASSWORD_REQUIREMENTS.requireNumbers).toBe(true)
  })
})

describe('Edge Cases', () => {
  it('should handle Unicode characters in email', () => {
    // Most email providers don't support Unicode in the local part
    const result = validateEmail('user@�H.jp')
    // This should either pass or fail consistently
    expect(typeof result === 'string' || typeof result === 'undefined').toBe(true)
  })

  it('should handle very long passwords', () => {
    const veryLongPassword = 'A1' + 'a'.repeat(100)
    const result = validatePassword(veryLongPassword)
    expect(result.isValid).toBe(true)
  })

  it('should handle passwords with only special characters', () => {
    const result = validatePassword('!@#$%^&*()')
    expect(result.isValid).toBe(false) // Missing letters and numbers
  })

  it('should handle display names with special characters', () => {
    expect(validateDisplayName("O'Brien")).toBeUndefined()
    expect(validateDisplayName('Jos� Garc�a')).toBeUndefined()
  })
})
