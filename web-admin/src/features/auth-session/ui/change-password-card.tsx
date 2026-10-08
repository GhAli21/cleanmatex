'use client'

/**
 * ChangePasswordCard — signed-in password change (current + new).
 *
 * A wrong current password counts toward the account lockout server-side; on success every OTHER
 * device is signed out and this session continues.
 */

import { useState, type FormEvent } from 'react'
import { useTranslations } from 'next-intl'
import { useMutation } from '@tanstack/react-query'
import { CmxButton, CmxInput } from '@ui/primitives'
import { CmxCard, CmxCardContent, CmxCardHeader, CmxCardTitle } from '@ui/primitives/cmx-card'
import { cmxMessage } from '@ui/feedback'
import { PASSWORD_ERROR_CODES } from '@/lib/constants/auth-session'
import { changePassword, PasswordApiError } from '../api/password-api'
import { validateNewPassword } from '../model/password-form'
import { NewPasswordFields } from './new-password-fields'

/** Change-password form card. */
export function ChangePasswordCard() {
  const t = useTranslations('authSession.password')
  const [current, setCurrent] = useState('')
  const [password, setPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [currentError, setCurrentError] = useState<string | undefined>()

  const mutation = useMutation({ mutationFn: changePassword })
  const validation = validateNewPassword(password, confirmation)

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault()
    setSubmitted(true)
    setCurrentError(undefined)
    if (!current) {
      setCurrentError(t('errors.currentRequired'))
      return
    }
    if (validation) return

    mutation.mutate(
      { currentPassword: current, newPassword: password },
      {
        onSuccess: (revoked) => {
          setCurrent('')
          setPassword('')
          setConfirmation('')
          setSubmitted(false)
          cmxMessage.success(t('changed', { count: revoked }))
        },
        onError: (error) => {
          const code = error instanceof PasswordApiError ? error.code : undefined
          if (code === PASSWORD_ERROR_CODES.WRONG_PASSWORD) setCurrentError(t('errors.wrongPassword'))
          else if (code === PASSWORD_ERROR_CODES.ACCOUNT_LOCKED) cmxMessage.error(t('errors.locked'))
          else if (code === PASSWORD_ERROR_CODES.SAME_PASSWORD) cmxMessage.error(t('errors.same'))
          else if (code === PASSWORD_ERROR_CODES.WEAK_PASSWORD) cmxMessage.error(t('errors.weak'))
          else cmxMessage.error(t('errors.failed'))
        },
      }
    )
  }

  return (
    <CmxCard>
      <CmxCardHeader>
        <CmxCardTitle>{t('title')}</CmxCardTitle>
      </CmxCardHeader>
      <CmxCardContent>
        <form onSubmit={handleSubmit} className="max-w-md space-y-4" noValidate>
          <p className="text-sm text-[rgb(var(--cmx-muted-foreground-rgb,100_116_139))]">{t('changeHint')}</p>
          <CmxInput
            id="change-password-current"
            type="password"
            autoComplete="current-password"
            label={t('currentPassword')}
            value={current}
            disabled={mutation.isPending}
            onChange={(event) => setCurrent(event.target.value)}
            error={currentError}
          />
          <NewPasswordFields
            idPrefix="change-password"
            password={password}
            confirmation={confirmation}
            onPasswordChange={setPassword}
            onConfirmationChange={setConfirmation}
            error={validation}
            showErrors={submitted}
            disabled={mutation.isPending}
          />
          <CmxButton type="submit" loading={mutation.isPending} disabled={mutation.isPending}>
            {t('submitChange')}
          </CmxButton>
        </form>
      </CmxCardContent>
    </CmxCard>
  )
}
