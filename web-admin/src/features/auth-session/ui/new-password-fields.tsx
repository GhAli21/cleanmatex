'use client'

/**
 * NewPasswordFields — "new password" + "confirm" pair shared by change-password and reset-password.
 *
 * Presentational: parent owns the values and decides when errors are shown (`showErrors`).
 */

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { CmxInput, CmxSwitch } from '@ui/primitives'
import type { NewPasswordError } from '../model/password-form'

interface NewPasswordFieldsProps {
  idPrefix: string
  password: string
  confirmation: string
  onPasswordChange: (value: string) => void
  onConfirmationChange: (value: string) => void
  /** Result of validateNewPassword(); shown only when `showErrors`. */
  error: NewPasswordError
  showErrors: boolean
  disabled?: boolean
  /** Keep the values visible (e.g. a just-generated temporary password the admin must read out). */
  forceReveal?: boolean
}

/**
 * @param props - Component props
 */
export function NewPasswordFields({
  idPrefix,
  password,
  confirmation,
  onPasswordChange,
  onConfirmationChange,
  error,
  showErrors,
  disabled,
  forceReveal,
}: NewPasswordFieldsProps) {
  const t = useTranslations('authSession.password')
  const [reveal, setReveal] = useState(false)
  const type = reveal || forceReveal ? 'text' : 'password'

  return (
    <div className="space-y-4">
      <CmxInput
        id={`${idPrefix}-new`}
        type={type}
        autoComplete="new-password"
        label={t('newPassword')}
        value={password}
        disabled={disabled}
        onChange={(event) => onPasswordChange(event.target.value)}
        error={showErrors && error === 'weak' ? t('errors.weak') : undefined}
      />
      <p className="-mt-2 text-xs text-[rgb(var(--cmx-muted-foreground-rgb,100_116_139))]">{t('policyHint')}</p>
      <CmxInput
        id={`${idPrefix}-confirm`}
        type={type}
        autoComplete="new-password"
        label={t('confirmPassword')}
        value={confirmation}
        disabled={disabled}
        onChange={(event) => onConfirmationChange(event.target.value)}
        error={showErrors && error === 'mismatch' ? t('errors.mismatch') : undefined}
      />
      <CmxSwitch size="sm" checked={reveal || !!forceReveal} onCheckedChange={setReveal} disabled={forceReveal} label={t('showPasswords')} />
    </div>
  )
}
