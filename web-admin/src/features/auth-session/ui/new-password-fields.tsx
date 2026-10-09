'use client'

/**
 * NewPasswordFields — "new password" + "confirm" pair shared by change-password and reset-password.
 *
 * Each field has its own eye. The "Show passwords" switch reveals both, and when the parent passes
 * `onRevealAllChange` it also reveals a sibling field (the current password). Requirements are a live
 * checklist: a check when met, an X when not.
 */

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { CmxSwitch } from '@ui/primitives'
import type { NewPasswordError } from '../model/password-form'
import { PasswordEyeInput } from './password-eye-input'
import { PasswordRequirements } from './password-requirements'

interface NewPasswordFieldsProps {
  idPrefix: string
  password: string
  confirmation: string
  onPasswordChange: (value: string) => void
  onConfirmationChange: (value: string) => void
  /** Result of validateNewPassword(); the checklist is the visible feedback. */
  error: NewPasswordError
  showErrors: boolean
  disabled?: boolean
  /** Keep the values visible (e.g. a just-generated temporary password the admin must read out). */
  forceReveal?: boolean
  /** Current password, so the checklist can mark "different from current". */
  currentPassword?: string
  compareCurrent?: boolean
  /** Server rejection of the password currently typed. Parent clears it when the value changes. */
  serverRule?: 'breached' | 'reused' | null
  /** The user pressed Skip on the breach warning for this password. */
  breachSkipped?: boolean
  /** Lets the user keep a password the breach check warned about. */
  onSkipBreach?: () => void
  showBreachRule?: boolean
  showReuseRule?: boolean
  /** Controlled reveal for the new-password field. Omit both callbacks to keep reveal inside this component. */
  passwordVisible?: boolean
  confirmationVisible?: boolean
  onPasswordVisibleChange?: (visible: boolean) => void
  onConfirmationVisibleChange?: (visible: boolean) => void
  /** Show-passwords switch also flips a sibling field (current password). */
  onRevealAllChange?: (visible: boolean) => void
  /** Checked state of the switch when a sibling field is included. */
  revealAllChecked?: boolean
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
  showErrors,
  disabled,
  forceReveal,
  currentPassword,
  compareCurrent,
  serverRule,
  breachSkipped,
  onSkipBreach,
  showBreachRule,
  showReuseRule,
  passwordVisible,
  confirmationVisible,
  onPasswordVisibleChange,
  onConfirmationVisibleChange,
  onRevealAllChange,
  revealAllChecked,
}: NewPasswordFieldsProps) {
  const t = useTranslations('authSession.password')
  const controlled = onPasswordVisibleChange != null && onConfirmationVisibleChange != null
  const [localPasswordVisible, setLocalPasswordVisible] = useState(false)
  const [localConfirmationVisible, setLocalConfirmationVisible] = useState(false)

  const passwordShown = !!forceReveal || (controlled ? !!passwordVisible : localPasswordVisible)
  const confirmationShown = !!forceReveal || (controlled ? !!confirmationVisible : localConfirmationVisible)

  const setPasswordShown = (visible: boolean) => {
    if (forceReveal) return
    if (controlled) onPasswordVisibleChange(visible)
    else setLocalPasswordVisible(visible)
  }
  const setConfirmationShown = (visible: boolean) => {
    if (forceReveal) return
    if (controlled) onConfirmationVisibleChange(visible)
    else setLocalConfirmationVisible(visible)
  }
  const setAllShown = (visible: boolean) => {
    if (forceReveal) return
    if (onRevealAllChange) onRevealAllChange(visible)
    else {
      setLocalPasswordVisible(visible)
      setLocalConfirmationVisible(visible)
    }
  }

  return (
    <div className="space-y-4">
      <PasswordEyeInput
        id={`${idPrefix}-new`}
        autoComplete="new-password"
        label={t('newPassword')}
        value={password}
        disabled={disabled}
        visible={passwordShown}
        forceVisible={forceReveal}
        onVisibleChange={setPasswordShown}
        onChange={(event) => onPasswordChange(event.target.value)}
      />
      <PasswordRequirements
        password={password}
        confirmation={confirmation}
        currentPassword={currentPassword}
        compareCurrent={compareCurrent}
        submitted={showErrors}
        serverRule={serverRule}
        breachSkipped={breachSkipped}
        onSkipBreach={onSkipBreach}
        disabled={disabled}
        showBreachRule={showBreachRule}
        showReuseRule={showReuseRule}
      />
      <PasswordEyeInput
        id={`${idPrefix}-confirm`}
        autoComplete="new-password"
        label={t('confirmPassword')}
        value={confirmation}
        disabled={disabled}
        visible={confirmationShown}
        forceVisible={forceReveal}
        onVisibleChange={setConfirmationShown}
        onChange={(event) => onConfirmationChange(event.target.value)}
      />
      <CmxSwitch
        size="sm"
        checked={!!forceReveal || (revealAllChecked ?? (passwordShown && confirmationShown))}
        onCheckedChange={setAllShown}
        disabled={forceReveal || disabled}
        label={t('showPasswords')}
      />
    </div>
  )
}
