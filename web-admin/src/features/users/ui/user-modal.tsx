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
import { CmxButton, CmxInput, CmxRadio, Label } from '@ui/primitives'
import {
  CmxDialog,
  CmxDialogContent,
  CmxDialogFooter,
  CmxDialogHeader,
  CmxDialogTitle,
} from '@ui/overlays'

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

/**
 *
 * @param root0
 * @param root0.user
 * @param root0.onClose
 * @param root0.onSaved
 * @param root0.accessToken
 * @param root0.availableRoles
 */
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
    <CmxDialog open onOpenChange={(next) => { if (!next && !loading) onClose() }}>
      <CmxDialogContent className="max-w-md w-full" scrollBody>
        <CmxDialogHeader>
          <CmxDialogTitle>
            {isEditMode ? 'Edit User' : 'Add New User'}
          </CmxDialogTitle>
        </CmxDialogHeader>

        {/* Form */}
        <form id="user-modal-form" onSubmit={handleSubmit} className="space-y-4">
          {/* General Error */}
          {errors.general && (
            <div className="rounded-md bg-danger-bg p-4">
              <p className="text-sm text-danger-text">{errors.general}</p>
            </div>
          )}

          {/* Email (new users only) */}
          {!isEditMode && (
            <CmxInput
              type="email"
              id="email"
              required
              label={t('emailLabel')}
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              error={errors.email}
              placeholder="user@example.com"
            />
          )}

          {/* Email display (edit mode) */}
          {isEditMode && (
            <div>
              <Label className="block text-sm font-medium text-foreground">
                {t('emailLabel')}
              </Label>
              <p className="mt-1 text-sm text-foreground"><bdi dir="ltr">{user.email}</bdi></p>
              <p className="mt-1 text-xs text-muted-foreground">{t('emailReadOnly')}</p>
            </div>
          )}

          {/* Password (new users only) */}
          {!isEditMode && (
            <>
              <CmxInput
                type="password"
                id="password"
                required
                passwordToggle
                label={t('passwordLabel')}
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                error={errors.password}
                helpText={t('passwordHint')}
                placeholder={t('passwordPlaceholder')}
              />

              <CmxInput
                type="password"
                id="confirmPassword"
                required
                passwordToggle
                label={t('confirmPasswordLabel')}
                value={formData.confirmPassword}
                onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                error={errors.confirmPassword}
                placeholder={t('confirmPasswordPlaceholder')}
              />
            </>
          )}

          {/* Display Name */}
          <CmxInput
            type="text"
            id="display_name"
            required
            label={t('displayNameLabel')}
            value={formData.display_name}
            onChange={(e) => setFormData({ ...formData, display_name: e.target.value })}
            error={errors.display_name}
            placeholder="John Doe"
          />

          {/* Role */}
          <div>
            <Label className="block text-sm font-medium text-foreground mb-2">
              {t('roleLabel')}
            </Label>
            <div className="space-y-2">
              {roleOptions.map((option) => (
                <div
                  key={option.value}
                  className={`relative rounded-lg border p-4 ${
                    formData.role === option.value
                      ? 'border-primary bg-info-bg'
                      : 'border-border'
                  }`}
                >
                  <CmxRadio
                    name="role"
                    value={option.value}
                    checked={formData.role === option.value}
                    onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                    label={option.label}
                    description={option.desc || undefined}
                  />
                </div>
              ))}
            </div>
          </div>
        </form>

        <CmxDialogFooter className="gap-3">
          <CmxButton
            type="button"
            variant="outline"
            onClick={onClose}
            disabled={loading}
          >
            {tCommon('cancel')}
          </CmxButton>
          <CmxButton
            type="submit"
            form="user-modal-form"
            variant="primary"
            loading={loading}
            disabled={loading}
          >
            {loading ? tCommon('saving') : isEditMode ? t('updateUser') : t('createUser')}
          </CmxButton>
        </CmxDialogFooter>
      </CmxDialogContent>
    </CmxDialog>
  )
}
