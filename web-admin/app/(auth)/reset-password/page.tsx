'use client'

/**
 * Reset Password Page
 *
 * Reached from the emailed link via /auth/callback, which exchanges the code for a recovery session and sets
 * the short-lived recovery cookie. Submitting calls POST /api/auth/password/reset, which ends EVERY session of
 * the user (including this one) — so on success we hard-navigate to /login (no client sign-out needed).
 */

import { CmxSummaryMessage } from '@ui/feedback/cmx-summary-message'
import { useEffect, useRef, useState, type FormEvent } from 'react'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { CmxButton } from '@ui/primitives'
import { LOGIN_REASONS, PASSWORD_ERROR_CODES, RECOVERY_REQUIRED_CODE } from '@/lib/constants/auth-session'
import { PasswordApiError, resetPassword } from '@features/auth-session/api/password-api'
import { validateNewPassword } from '@features/auth-session/model/password-form'
import { NewPasswordFields } from '@features/auth-session/ui/new-password-fields'

const REDIRECT_DELAY_MS = 2500

type View = 'form' | 'done' | 'invalid'

/** Full-page shell shared by the three states. */
function Shell({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-muted px-4 sm:px-6 lg:px-8">
      <div className="w-full max-w-md space-y-6">
        <div>
          <h1 className="text-center text-3xl font-bold tracking-tight text-foreground">{title}</h1>
          {subtitle ? <p className="mt-2 text-center text-sm text-muted-foreground">{subtitle}</p> : null}
        </div>
        {children}
      </div>
    </div>
  )
}

/**
 * Reset password page.
 */
export default function ResetPasswordPage() {
  const t = useTranslations('auth.resetPassword')
  const [password, setPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [pending, setPending] = useState(false)
  const [view, setView] = useState<View>('form')
  const [errorMessage, setErrorMessage] = useState<string | undefined>()
  const redirectTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  useEffect(() => () => clearTimeout(redirectTimer.current), [])

  const validation = validateNewPassword(password, confirmation)

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    setSubmitted(true)
    setErrorMessage(undefined)
    if (validation) return

    setPending(true)
    try {
      await resetPassword({ newPassword: password })
      setView('done')
      // Every session (including this one) was ended server-side; a full navigation drops all client state.
      redirectTimer.current = setTimeout(() => {
        window.location.assign(`/login?reason=${LOGIN_REASONS.PASSWORD_CHANGED}`)
      }, REDIRECT_DELAY_MS)
    } catch (error) {
      const code = error instanceof PasswordApiError ? error.code : undefined
      if (code === RECOVERY_REQUIRED_CODE) setView('invalid')
      else if (code === PASSWORD_ERROR_CODES.WEAK_PASSWORD) setErrorMessage(undefined)
      else setErrorMessage(t('failed'))
    } finally {
      setPending(false)
    }
  }

  if (view === 'invalid') {
    return (
      <Shell title={t('invalidTitle')} subtitle={t('invalidBody')}>
        <div className="flex gap-3">
          <Link
            href="/forgot-password"
            className="flex flex-1 justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary-hover"
          >
            {t('requestNew')}
          </Link>
          <Link
            href="/login"
            className="flex flex-1 justify-center rounded-md border border-border bg-card px-4 py-2 text-sm font-medium text-foreground hover:bg-muted"
          >
            {t('backToLogin')}
          </Link>
        </div>
      </Shell>
    )
  }

  if (view === 'done') {
    return (
      <Shell title={t('successTitle')}>
        <CmxSummaryMessage type="success" role="status">
          <div>{t('successBody')}</div>
        </CmxSummaryMessage>
        <div className="text-center">
          <a href={`/login?reason=${LOGIN_REASONS.PASSWORD_CHANGED}`} className="text-sm font-medium text-primary-text hover:text-primary-text/80">
            {t('backToLogin')}
          </a>
        </div>
      </Shell>
    )
  }

  return (
    <Shell title={t('title')} subtitle={t('subtitle')}>
      <form onSubmit={handleSubmit} className="space-y-6" noValidate>
        {errorMessage ? (
          <CmxSummaryMessage type="error" role="alert">
            <div>{errorMessage}</div>
          </CmxSummaryMessage>
        ) : null}
        <NewPasswordFields
          idPrefix="reset-password"
          password={password}
          confirmation={confirmation}
          onPasswordChange={setPassword}
          onConfirmationChange={setConfirmation}
          error={validation}
          showErrors={submitted}
          disabled={pending}
        />
        <CmxButton type="submit" className="w-full" loading={pending} disabled={pending}>
          {pending ? t('submitting') : t('submit')}
        </CmxButton>
        <div className="text-center">
          <Link href="/login" className="text-sm font-medium text-primary-text hover:text-primary-text/80">
            {t('backToLogin')}
          </Link>
        </div>
      </form>
    </Shell>
  )
}
