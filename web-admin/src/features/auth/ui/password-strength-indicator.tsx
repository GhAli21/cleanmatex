'use client'

/**
 * Password Strength Indicator Component
 *
 * Visual indicator showing password strength based on requirements:
 * - Length (min 8 characters)
 * - Uppercase letters
 * - Lowercase letters
 * - Numbers
 * - Optional: Special characters
 */

import { useMemo } from 'react'

interface PasswordStrengthIndicatorProps {
  password: string
  showRequirements?: boolean
}

export interface PasswordStrength {
  score: number // 0-4
  label: string // 'Very Weak', 'Weak', 'Fair', 'Strong', 'Very Strong'
  color: string // Tailwind color class
  percentage: number // 0-100
  requirements: {
    minLength: boolean
    hasUppercase: boolean
    hasLowercase: boolean
    hasNumber: boolean
    hasSpecial: boolean
  }
}

/**
 * Calculate password strength score
 */
function calculatePasswordStrength(password: string): PasswordStrength {
  const requirements = {
    minLength: password.length >= 8,
    hasUppercase: /[A-Z]/.test(password),
    hasLowercase: /[a-z]/.test(password),
    hasNumber: /\d/.test(password),
    hasSpecial: /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password),
  }

  // Calculate score (0-4)
  let score = 0
  if (requirements.minLength) score++
  if (requirements.hasUppercase) score++
  if (requirements.hasLowercase) score++
  if (requirements.hasNumber) score++

  // Bonus for special characters (doesn't add to base score but improves label)
  const hasAll = requirements.minLength && requirements.hasUppercase &&
                 requirements.hasLowercase && requirements.hasNumber

  // Determine label and color
  let label = 'Very Weak'
  let color = 'bg-red-500'
  let percentage = 25

  if (score === 0) {
    label = 'Very Weak'
    color = 'bg-red-500'
    percentage = 0
  } else if (score === 1) {
    label = 'Weak'
    color = 'bg-red-400'
    percentage = 25
  } else if (score === 2) {
    label = 'Fair'
    color = 'bg-yellow-400'
    percentage = 50
  } else if (score === 3) {
    label = 'Good'
    color = 'bg-blue-500'
    percentage = 75
  } else if (score === 4) {
    if (requirements.hasSpecial) {
      label = 'Very Strong'
      color = 'bg-green-600'
      percentage = 100
    } else {
      label = 'Strong'
      color = 'bg-green-500'
      percentage = 90
    }
  }

  return {
    score,
    label,
    color,
    percentage,
    requirements,
  }
}

export function PasswordStrengthIndicator({
  password,
  showRequirements = true,
}: PasswordStrengthIndicatorProps) {
  const strength = useMemo(() => calculatePasswordStrength(password), [password])

  if (!password) return null

  return (
    <div className="mt-2 space-y-2">
      {/* Strength Bar */}
      <div>
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs font-medium text-gray-700">
            Password Strength:
          </span>
          <span className={`text-xs font-semibold ${
            strength.score >= 3 ? 'text-green-600' :
            strength.score === 2 ? 'text-yellow-600' :
            'text-red-600'
          }`}>
            {strength.label}
          </span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div
            className={`h-2 rounded-full transition-all duration-300 ${strength.color}`}
            style={{ width: `${strength.percentage}%` }}
          />
        </div>
      </div>

      {/* Requirements Checklist */}
      {showRequirements && (
        <div className="space-y-1">
          <RequirementItem
            met={strength.requirements.minLength}
            text="At least 8 characters"
          />
          <RequirementItem
            met={strength.requirements.hasUppercase}
            text="One uppercase letter"
          />
          <RequirementItem
            met={strength.requirements.hasLowercase}
            text="One lowercase letter"
          />
          <RequirementItem
            met={strength.requirements.hasNumber}
            text="One number"
          />
          <RequirementItem
            met={strength.requirements.hasSpecial}
            text="One special character (optional, but recommended)"
            optional
          />
        </div>
      )}
    </div>
  )
}

/**
 * Individual requirement item
 */
function RequirementItem({
  met,
  text,
  optional = false,
}: {
  met: boolean
  text: string
  optional?: boolean
}) {
  return (
    <div className="flex items-center gap-2">
      <div className={`flex-shrink-0 ${met ? 'text-green-500' : 'text-gray-400'}`}>
        {met ? (
          <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
            <path
              fillRule="evenodd"
              d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
              clipRule="evenodd"
            />
          </svg>
        ) : (
          <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
            <path
              fillRule="evenodd"
              d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
              clipRule="evenodd"
            />
          </svg>
        )}
      </div>
      <span className={`text-xs ${
        met ? 'text-green-700 font-medium' :
        optional ? 'text-gray-500' : 'text-gray-600'
      }`}>
        {text}
      </span>
    </div>
  )
}

/**
 * Utility function to validate password strength
 * Returns true if password meets minimum requirements
 */
export function isPasswordStrong(password: string): boolean {
  const strength = calculatePasswordStrength(password)
  return strength.requirements.minLength &&
         strength.requirements.hasUppercase &&
         strength.requirements.hasLowercase &&
         strength.requirements.hasNumber
}

/**
 * Get password validation error message
 * Returns null if password is valid
 */
export function getPasswordError(password: string): string | null {
  const strength = calculatePasswordStrength(password)

  if (!strength.requirements.minLength) {
    return 'Password must be at least 8 characters long'
  }
  if (!strength.requirements.hasUppercase) {
    return 'Password must contain at least one uppercase letter'
  }
  if (!strength.requirements.hasLowercase) {
    return 'Password must contain at least one lowercase letter'
  }
  if (!strength.requirements.hasNumber) {
    return 'Password must contain at least one number'
  }

  return null
}
