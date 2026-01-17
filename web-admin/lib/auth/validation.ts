/**
 * Authentication Validation Utilities
 *
 * Email, password, and form validation functions
 */

import type { FormErrors, PasswordStrength, PasswordRequirements } from '@/types/auth'

/**
 * Password requirements configuration
 */
export const PASSWORD_REQUIREMENTS: PasswordRequirements = {
  minLength: 8,
  requireUppercase: true,
  requireLowercase: true,
  requireNumbers: true,
  requireSpecialChars: true, // Required for security
}

/**
 * Validate email format
 */
export function validateEmail(email: string): string | undefined {
  if (!email) {
    return 'Email is required'
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  if (!emailRegex.test(email)) {
    return 'Please enter a valid email address'
  }

  return undefined
}

/**
 * Validate password strength
 */
export function validatePassword(password: string): PasswordStrength {
  const feedback: string[] = []
  let score = 0

  // Check length
  if (password.length < PASSWORD_REQUIREMENTS.minLength) {
    feedback.push(`Password must be at least ${PASSWORD_REQUIREMENTS.minLength} characters`)
  } else {
    score++
  }

  // Check uppercase
  if (PASSWORD_REQUIREMENTS.requireUppercase && !/[A-Z]/.test(password)) {
    feedback.push('Password must contain at least one uppercase letter')
  } else if (PASSWORD_REQUIREMENTS.requireUppercase) {
    score++
  }

  // Check lowercase
  if (PASSWORD_REQUIREMENTS.requireLowercase && !/[a-z]/.test(password)) {
    feedback.push('Password must contain at least one lowercase letter')
  } else if (PASSWORD_REQUIREMENTS.requireLowercase) {
    score++
  }

  // Check numbers
  if (PASSWORD_REQUIREMENTS.requireNumbers && !/\d/.test(password)) {
    feedback.push('Password must contain at least one number')
  } else if (PASSWORD_REQUIREMENTS.requireNumbers) {
    score++
  }

  // Check special characters (optional)
  if (PASSWORD_REQUIREMENTS.requireSpecialChars && !/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
    feedback.push('Password must contain at least one special character')
  } else if (PASSWORD_REQUIREMENTS.requireSpecialChars) {
    score++
  }

  // Additional strength checks
  if (password.length >= 12) score++
  if (/[!@#$%^&*(),.?":{}|<>]/.test(password)) score++ // Bonus for special chars

  return {
    isValid: feedback.length === 0,
    score: Math.min(score, 4), // Cap at 4
    feedback,
  }
}

/**
 * Validate password match
 */
export function validatePasswordMatch(
  password: string,
  confirmPassword: string
): string | undefined {
  if (!confirmPassword) {
    return 'Please confirm your password'
  }

  if (password !== confirmPassword) {
    return 'Passwords do not match'
  }

  return undefined
}

/**
 * Validate display name
 */
export function validateDisplayName(displayName: string): string | undefined {
  if (!displayName || displayName.trim().length === 0) {
    return 'Display name is required'
  }

  if (displayName.trim().length < 2) {
    return 'Display name must be at least 2 characters'
  }

  if (displayName.length > 50) {
    return 'Display name must be less than 50 characters'
  }

  return undefined
}

/**
 * Validate login form
 */
export function validateLoginForm(
  email: string,
  password: string
): FormErrors {
  const errors: FormErrors = {}

  const emailError = validateEmail(email)
  if (emailError) errors.email = emailError

  if (!password) {
    errors.password = 'Password is required'
  }

  return errors
}

/**
 * Validate registration form
 */
export function validateRegistrationForm(
  email: string,
  password: string,
  confirmPassword: string,
  displayName: string
): FormErrors {
  const errors: FormErrors = {}

  const emailError = validateEmail(email)
  if (emailError) errors.email = emailError

  const passwordStrength = validatePassword(password)
  if (!passwordStrength.isValid) {
    errors.password = passwordStrength.feedback.join('. ')
  }

  const passwordMatchError = validatePasswordMatch(password, confirmPassword)
  if (passwordMatchError) {
    errors.password = passwordMatchError
  }

  const nameError = validateDisplayName(displayName)
  if (nameError) errors.displayName = nameError

  return errors
}

/**
 * Get password strength label
 */
export function getPasswordStrengthLabel(score: number): {
  label: string
  color: string
} {
  switch (score) {
    case 0:
    case 1:
      return { label: 'Weak', color: 'text-red-500' }
    case 2:
      return { label: 'Fair', color: 'text-orange-500' }
    case 3:
      return { label: 'Good', color: 'text-yellow-500' }
    case 4:
      return { label: 'Strong', color: 'text-green-500' }
    default:
      return { label: 'Unknown', color: 'text-gray-500' }
  }
}

/**
 * Validate registration form (alias)
 */
export const validateRegisterForm = validateRegistrationForm

/**
 * Sanitize input (prevent XSS)
 */
export function sanitizeInput(input: string): string {
  return input
    .replace(/[<>]/g, '') // Remove < and >
    .trim()
}
