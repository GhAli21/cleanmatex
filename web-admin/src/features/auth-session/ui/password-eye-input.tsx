'use client'

/**
 * Password field that uses CmxInput's own reveal control.
 * Reveal state stays outside the field so one switch can show every password at once.
 */

import { useTranslations } from 'next-intl'
import { CmxInput, type CmxInputProps } from '@ui/primitives'

interface PasswordEyeInputProps extends Omit<CmxInputProps, 'type' | 'trailing' | 'passwordToggle'> {
  visible: boolean
  onVisibleChange: (visible: boolean) => void
  /** Keep the value visible and do not let the eye hide it (generated temporary password). */
  forceVisible?: boolean
}

/**
 * @param props - CmxInput props plus reveal state
 */
export function PasswordEyeInput({
  visible,
  onVisibleChange,
  forceVisible,
  disabled,
  ...props
}: PasswordEyeInputProps) {
  const t = useTranslations('auth.login')

  return (
    <CmxInput
      {...props}
      type="password"
      disabled={disabled}
      passwordToggle
      passwordVisible={!!forceVisible || visible}
      passwordRevealLocked={forceVisible}
      onPasswordVisibleChange={onVisibleChange}
      showPasswordLabel={t('showPassword')}
      hidePasswordLabel={t('hidePassword')}
    />
  )
}
