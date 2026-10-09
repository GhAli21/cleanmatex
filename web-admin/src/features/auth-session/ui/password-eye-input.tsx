'use client'

/**
 * Password field with an eye that reveals only this field.
 */

import { Eye, EyeOff } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { CmxButton, CmxInput, type CmxInputProps } from '@ui/primitives'

interface PasswordEyeInputProps extends Omit<CmxInputProps, 'type' | 'trailing'> {
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
  const shown = forceVisible || visible

  return (
    <CmxInput
      {...props}
      type={shown ? 'text' : 'password'}
      disabled={disabled}
      trailing={
        <CmxButton
          type="button"
          variant="ghost"
          size="xs"
          className="h-7 w-7 px-0"
          disabled={forceVisible}
          aria-pressed={shown}
          aria-label={shown ? t('hidePassword') : t('showPassword')}
          onClick={() => onVisibleChange(!shown)}
        >
          {shown ? <EyeOff className="h-4 w-4" aria-hidden /> : <Eye className="h-4 w-4" aria-hidden />}
        </CmxButton>
      }
    />
  )
}
