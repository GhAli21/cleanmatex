'use client'

/**
 * ForcedPasswordChangeScreen — "Set a new password" shown to a user whose administrator set a temporary password.
 *
 * Everything else is blocked by the proxy / API gate until this succeeds. Two fields only (new + re-type): the
 * user has just proved the temporary password by signing in. On success the user continues into the dashboard;
 * all other devices were signed out by the server. "Sign out" is always available.
 */

import { useState, type FormEvent } from 'react'
import { useTranslations } from 'next-intl'
import { Alert, AlertDescription, CmxButton } from '@ui/primitives'
import { useAuth } from '@/lib/auth/auth-context'
import { changePassword, PasswordApiError } from '../api/password-api'
import { passwordErrorKey } from '../model/password-errors'
import { validateNewPassword } from '../model/password-form'
import { NewPasswordFields } from './new-password-fields'

/** Forced password change screen (rendered by /change-password). */
export function ForcedPasswordChangeScreen() {
  const t = useTranslations('authSession.password')
  const { signOut } = useAuth()
  const [password, setPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [pending, setPending] = useState(false)
  const [errorKey, setErrorKey] = useState<string | undefined>()

  const validation = validateNewPassword(password, confirmation)

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    setSubmitted(true)
    setErrorKey(undefined)
    if (validation) return

    setPending(true)
    try {
      await changePassword({ newPassword: password })
      // Full navigation: the proxy re-reads the session (flag now cleared) and all client caches start fresh.
      window.location.assign('/dashboard')
    } catch (error) {
      setErrorKey(passwordErrorKey(error instanceof PasswordApiError ? error.code : undefined))
      setPending(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4 sm:px-6 lg:px-8">
      <div className="w-full max-w-md space-y-6">
        <div>
          <h1 className="text-center text-3xl font-bold tracking-tight text-gray-900">{t('forced.title')}</h1>
          <p className="mt-2 text-center text-sm text-gray-600">{t('forced.subtitle')}</p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-6" noValidate>
          {errorKey ? (
            <Alert variant="error" role="alert">
              <AlertDescription>{t(`errors.${errorKey}`)}</AlertDescription>
            </Alert>
          ) : null}
          <NewPasswordFields
            idPrefix="forced-password"
            password={password}
            confirmation={confirmation}
            onPasswordChange={setPassword}
            onConfirmationChange={setConfirmation}
            error={validation}
            showErrors={submitted}
            disabled={pending}
          />
          <CmxButton type="submit" className="w-full" loading={pending} disabled={pending}>
            {t('forced.submit')}
          </CmxButton>
          <div className="text-center">
            <button
              type="button"
              className="text-sm font-medium text-blue-600 hover:text-blue-500"
              onClick={() => void signOut('user')}
            >
              {t('forced.signOut')}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
