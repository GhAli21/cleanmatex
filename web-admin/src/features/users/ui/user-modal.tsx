'use client'

/**
 * User Modal Component
 *
 * Modal for adding new users or editing existing users.
 * All API calls go through platform-api via lib/api/users.
 * Uses roles from sys_auth_roles (via getAllRoles) when available.
 * No Supabase imports.
 */

import { useTranslations } from 'next-intl'
import { useState, FormEvent } from 'react'
import { useAuth } from '@/lib/auth/auth-context'
import { createUser, updateUser } from '@/lib/api/users'
import { validateEmail, validatePassword } from '@/lib/auth/validation'
import type { TenantUser, CreateUserData, UpdateUserData } from '@/lib/api/users'
import type { TenantRole } from '@/lib/api/roles'

interface UserModalProps {
  user: TenantUser | null
  onClose: () => void
  onSaved: () => void
  accessToken: string
  /** Roles from sys_auth_roles (getAllRoles). When provided, used instead of hardcoded list. */
  availableRoles?: TenantRole[]
}

// Fallback role options when API roles not available (must match sys_auth_roles codes)
const FALLBACK_ROLE_OPTIONS = [
  { value: 'viewer', labelKey: 'viewer', descKey: 'viewerDesc' },
  { value: 'operator', labelKey: 'operator', descKey: 'operatorDesc' },
  { value: 'tenant_admin', labelKey: 'tenant_admin', descKey: 'tenant_adminDesc' },
  { value: 'branch_manager', labelKey: 'branch_manager', descKey: 'branch_managerDesc' },
] as const

export default function UserModal({ user, onClose, onSaved, accessToken, availableRoles }: UserModalProps) {
  const t = useTranslations('users.modal')
  const tValidation = useTranslations('users.validation')
  const tCommon = useTranslations('common')
  const { currentTenant } = useAuth()
  const isEditMode = !!user

  // Build role options: use API roles when available, else fallback
  const roleOptions: { value: string; label: string; desc: string }[] = (() => {
    if (availableRoles?.length) {
      return availableRoles
        .filter((r) => r.is_active && r.code !== 'super_admin')
        .map((r) => ({
          value: r.code,
          label: r.name || r.code,
          desc: r.description || '',
        }))
    }
    return FALLBACK_ROLE_OPTIONS.map((opt) => ({
      value: opt.value,
      label: t(`roles.${opt.labelKey}`),
      desc: t(`roles.${opt.descKey}`),
    }))
  })()

  const defaultRole = roleOptions.length ? roleOptions[0].value : 'viewer'
  const effectiveUserRole = user?.role === 'admin' ? 'tenant_admin' : user?.role
  const initialRole =
    effectiveUserRole && roleOptions.some((o) => o.value === effectiveUserRole) ? effectiveUserRole : defaultRole

  // Form state
  const [formData, setFormData] = useState({
    email: user?.email || '',
    password: '',
    confirmPassword: '',
    display_name: user?.display_name || '',
    role: initialRole,
  })

  const [errors, setErrors] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)

  // Validation
  const validate = (): boolean => {
    const newErrors: Record<string, string> = {}

    // Email and password validation for new users only
    if (!isEditMode) {
      const emailError = validateEmail(formData.email)
      if (emailError) {
        newErrors.email = emailError
      }

      if (!formData.password) {
        newErrors.password = tValidation('passwordRequired')
      } else {
        const passwordStrength = validatePassword(formData.password)
        if (!passwordStrength.isValid) {
          newErrors.password = passwordStrength.feedback.join('. ')
        }
      }

      if (formData.password !== formData.confirmPassword) {
        newErrors.confirmPassword = tValidation('passwordsMismatch')
      }
    }

    // Display name validation
    if (!formData.display_name || formData.display_name.trim().length === 0) {
      newErrors.display_name = tValidation('displayNameRequired')
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  // Handle submit
  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()

    if (!validate()) return
    if (!currentTenant) return

    setLoading(true)

    try {
      let result

      if (isEditMode) {
        const updateData: UpdateUserData = {
          display_name: formData.display_name,
          role: formData.role,
        }
        result = await updateUser(currentTenant.tenant_id, user.user_id, updateData, accessToken)
      } else {
        const createData: CreateUserData = {
          email: formData.email,
          password: formData.password,
          display_name: formData.display_name,
          role: formData.role,
        }
        result = await createUser(currentTenant.tenant_id, createData, accessToken)
      }

      if (result.success) {
        onSaved()
      } else {
        setErrors({ general: result.error || result.message || tValidation('operationFailed') })
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'An error occurred'
      console.error('Error saving user:', error)
      setErrors({ general: message })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-medium text-gray-900">
              {isEditMode ? 'Edit User' : 'Add New User'}
            </h3>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-500"
            >
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="px-6 py-4 space-y-4">
          {/* General Error */}
          {errors.general && (
            <div className="rounded-md bg-red-50 p-4">
              <p className="text-sm text-red-800">{errors.general}</p>
            </div>
          )}

          {/* Email (new users only) */}
          {!isEditMode && (
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                {t('emailLabel')} *
              </label>
              <input
                type="email"
                id="email"
                required
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className={`mt-1 block w-full rounded-md shadow-sm sm:text-sm ${
                  errors.email
                    ? 'border-red-300 focus:border-red-500 focus:ring-red-500'
                    : 'border-gray-300 focus:border-blue-500 focus:ring-blue-500'
                }`}
                placeholder="user@example.com"
              />
              {errors.email && (
                <p className="mt-1 text-sm text-red-600">{errors.email}</p>
              )}
            </div>
          )}

          {/* Email display (edit mode) */}
          {isEditMode && (
            <div>
              <label className="block text-sm font-medium text-gray-700">
                {t('emailLabel')}
              </label>
              <p className="mt-1 text-sm text-gray-900">{user.email}</p>
              <p className="mt-1 text-xs text-gray-500">{t('emailReadOnly')}</p>
            </div>
          )}

          {/* Password (new users only) */}
          {!isEditMode && (
            <>
              <div>
                <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                  {t('passwordLabel')} *
                </label>
                <div className="relative mt-1">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    id="password"
                    required
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    className={`block w-full rounded-md shadow-sm sm:text-sm ${
                      errors.password
                        ? 'border-red-300 focus:border-red-500 focus:ring-red-500'
                        : 'border-gray-300 focus:border-blue-500 focus:ring-blue-500'
                    }`}
                    placeholder={t('passwordPlaceholder')}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center"
                  >
                    {showPassword ? (
                      <svg className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                      </svg>
                    ) : (
                      <svg className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                    )}
                  </button>
                </div>
                {errors.password && (
                  <p className="mt-1 text-sm text-red-600">{errors.password}</p>
                )}
                <p className="mt-1 text-xs text-gray-500">{t('passwordHint')}</p>
              </div>

              <div>
                <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700">
                  {t('confirmPasswordLabel')}
                </label>
                <div className="relative mt-1">
                  <input
                    type={showConfirmPassword ? 'text' : 'password'}
                    id="confirmPassword"
                    required
                    value={formData.confirmPassword}
                    onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                    className={`block w-full rounded-md shadow-sm sm:text-sm ${
                      errors.confirmPassword
                        ? 'border-red-300 focus:border-red-500 focus:ring-red-500'
                        : 'border-gray-300 focus:border-blue-500 focus:ring-blue-500'
                    }`}
                    placeholder={t('confirmPasswordPlaceholder')}
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center"
                  >
                    {showConfirmPassword ? (
                      <svg className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                      </svg>
                    ) : (
                      <svg className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                    )}
                  </button>
                </div>
                {errors.confirmPassword && (
                  <p className="mt-1 text-sm text-red-600">{errors.confirmPassword}</p>
                )}
              </div>
            </>
          )}

          {/* Display Name */}
          <div>
            <label htmlFor="display_name" className="block text-sm font-medium text-gray-700">
              {t('displayNameLabel')}
            </label>
            <input
              type="text"
              id="display_name"
              required
              value={formData.display_name}
              onChange={(e) => setFormData({ ...formData, display_name: e.target.value })}
              className={`mt-1 block w-full rounded-md shadow-sm sm:text-sm ${
                errors.display_name
                  ? 'border-red-300 focus:border-red-500 focus:ring-red-500'
                  : 'border-gray-300 focus:border-blue-500 focus:ring-blue-500'
              }`}
              placeholder="John Doe"
            />
            {errors.display_name && (
              <p className="mt-1 text-sm text-red-600">{errors.display_name}</p>
            )}
          </div>

          {/* Role */}
          <div>
            <label htmlFor="role" className="block text-sm font-medium text-gray-700 mb-2">
              {t('roleLabel')}
            </label>
            <div className="space-y-2">
              {roleOptions.map((option) => (
                <label
                  key={option.value}
                  className={`relative flex cursor-pointer rounded-lg border p-4 focus:outline-none ${
                    formData.role === option.value
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-300'
                  }`}
                >
                  <input
                    type="radio"
                    name="role"
                    value={option.value}
                    checked={formData.role === option.value}
                    onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                    className="mt-0.5 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300"
                  />
                  <span className="ml-3 rtl:ml-0 rtl:mr-3 flex flex-col">
                    <span className="block text-sm font-medium text-gray-900">{option.label}</span>
                    {option.desc && (
                      <span className="block text-sm text-gray-500">{option.desc}</span>
                    )}
                  </span>
                </label>
              ))}
            </div>
          </div>
        </form>

        {/* Footer */}
        <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 flex justify-end space-x-3 rtl:space-x-reverse">
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
          >
            {tCommon('cancel')}
          </button>
          <button
            onClick={handleSubmit}
            disabled={loading}
            className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
          >
            {loading && (
              <svg
                className="animate-spin -ml-1 mr-2 h-4 w-4 text-white"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                />
              </svg>
            )}
            {loading ? tCommon('saving') : isEditMode ? t('updateUser') : t('createUser')}
          </button>
        </div>
      </div>
    </div>
  )
}
