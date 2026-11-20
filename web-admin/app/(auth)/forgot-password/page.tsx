'use client'

/**
 * Forgot Password Page
 *
 * Request password reset email
 */

import { useState, FormEvent, Suspense } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { useAuth } from '@/lib/auth/auth-context'
import { validateEmail } from '@/lib/auth/validation'
import type { FormErrors } from '@/types/auth'
import { CmxButton, CmxInput, Label } from '@ui/primitives'

function ForgotPasswordForm() {
  const { resetPassword, isLoading } = useAuth()
  const tReset = useTranslations('auth.resetPassword')
  const t = useTranslations('auth.forgotPassword')
  // /auth/callback sends users here with ?error=invalid_link when the emailed link failed to exchange.
  const invalidLink = useSearchParams().get('error') === 'invalid_link'

  const [email, setEmail] = useState('')
  const [errors, setErrors] = useState<FormErrors>({})
  const [emailSent, setEmailSent] = useState(false)

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()

    // Validate email
    const emailError = validateEmail(email)
    if (emailError) {
      setErrors({ email: emailError })
      return
    }

    setErrors({})

    try {
      await resetPassword(email)
      setEmailSent(true)
    } catch (error: any) {
      console.error('Reset password error:', error)
      setErrors({
        general: error.message || t('sendFailed'),
      })
    }
  }

  // Show success message after email is sent
  if (emailSent) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted px-4 sm:px-6 lg:px-8">
        <div className="max-w-md w-full space-y-8">
          <div>
            <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-success-bg">
              <svg
                className="h-6 w-6 text-success-text"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                />
              </svg>
            </div>
            <h2 className="mt-6 text-center text-3xl font-bold tracking-tight text-foreground">
              {t('checkEmailTitle')}
            </h2>
            <p className="mt-2 text-center text-sm text-muted-foreground">
              {t('checkEmailBody', { email })}
            </p>
          </div>

          <div className="rounded-md bg-info-bg p-4">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg
                  className="h-5 w-5 text-primary-text"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                >
                  <path
                    fillRule="evenodd"
                    d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
                    clipRule="evenodd"
                  />
                </svg>
              </div>
              <div className="ms-3">
                <h3 className="text-sm font-medium text-primary-text">{t('nextSteps')}</h3>
                <div className="mt-2 text-sm text-primary-text">
                  <ol className="list-decimal list-inside space-y-1">
                    <li>{t('step1')}</li>
                    <li>{t('step2')}</li>
                    <li>{t('step3')}</li>
                    <li>{t('step4')}</li>
                  </ol>
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-md bg-warning-bg p-4">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg
                  className="h-5 w-5 text-warning-text"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                >
                  <path
                    fillRule="evenodd"
                    d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                    clipRule="evenodd"
                  />
                </svg>
              </div>
              <div className="ms-3">
                <p className="text-sm text-warning-text">
                  {t('expiresIn1Hour')}{' '}
                  <CmxButton
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setEmailSent(false)}
                    className="h-auto px-0 py-0 font-medium underline text-warning-text hover:bg-transparent hover:text-warning-text"
                  >
                    {t('tryAgain')}
                  </CmxButton>
                </p>
              </div>
            </div>
          </div>

          <div className="text-center">
            <Link
              href="/login"
              className="font-medium text-primary-text hover:text-primary-text/80"
            >
              {t('backToLogin')}
            </Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        {/* Header */}
        <div>
          <h2 className="mt-6 text-center text-3xl font-bold tracking-tight text-foreground">
            {t('title')}
          </h2>
          <p className="mt-2 text-center text-sm text-muted-foreground">
            {t('subtitle')}
          </p>
        </div>

        {/* Form */}
        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          {invalidLink && !errors.general && (
            <div className="rounded-md bg-danger-bg p-4" role="alert">
              <p className="text-sm font-medium text-danger-text">{tReset('linkError')}</p>
            </div>
          )}

          {/* General Error */}
          {errors.general && (
            <div className="rounded-md bg-danger-bg p-4">
              <div className="flex">
                <div className="flex-shrink-0">
                  <svg
                    className="h-5 w-5 text-danger-text"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                  >
                    <path
                      fillRule="evenodd"
                      d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                      clipRule="evenodd"
                    />
                  </svg>
                </div>
                <div className="ms-3">
                  <p className="text-sm font-medium text-danger-text">{errors.general}</p>
                </div>
              </div>
            </div>
          )}

          {/* Email Field */}
          <div>
            <Label htmlFor="email" className="block mb-1">
              {t('emailLabel')}
            </Label>
            <CmxInput
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              error={errors.email}
              placeholder={t('emailPlaceholder')}
            />
          </div>

          {/* Submit Button */}
          <div>
            <CmxButton
              type="submit"
              disabled={isLoading}
              loading={isLoading}
              className="w-full"
            >
              {isLoading ? t('sending') : t('submit')}
            </CmxButton>
          </div>

          {/* Back to login */}
          <div className="text-center">
            <Link
              href="/login"
              className="font-medium text-primary-text hover:text-primary-text/80"
            >
              {t('backToLogin')}
            </Link>
          </div>
        </form>

        {/* Help text */}
        <div className="rounded-md bg-muted p-4">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg
                className="h-5 w-5 text-muted-foreground"
                viewBox="0 0 20 20"
                fill="currentColor"
              >
                <path
                  fillRule="evenodd"
                  d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-3a1 1 0 00-.867.5 1 1 0 11-1.731-1A3 3 0 0113 8a3.001 3.001 0 01-2 2.83V11a1 1 0 11-2 0v-1a1 1 0 011-1 1 1 0 100-2zm0 8a1 1 0 100-2 1 1 0 000 2z"
                  clipRule="evenodd"
                />
              </svg>
            </div>
            <div className="ms-3">
              <p className="text-sm text-foreground">
                {t('noAccount')}{' '}
                <Link href="/register" className="font-medium text-primary-text hover:text-primary-text/80">
                  {t('signUp')}
                </Link>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

/**
 * Forgot password page (Suspense boundary required by useSearchParams).
 */
export default function ForgotPasswordPage() {
  return (
    <Suspense fallback={null}>
      <ForgotPasswordForm />
    </Suspense>
  )
}
