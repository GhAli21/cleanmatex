'use client'

/**
 * Email Verification Notice Page
 *
 * Displayed after registration to prompt user to verify email
 * Also handles email verification callback from Supabase
 */

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { supabase } from '@/lib/supabase/client'
import { CmxButton } from '@ui/primitives'

function VerifyEmailContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const t = useTranslations('auth.verifyEmail')

  const [email, setEmail] = useState('')
  const [isVerifying, setIsVerifying] = useState(false)
  const [verificationSuccess, setVerificationSuccess] = useState(false)
  const [verificationError, setVerificationError] = useState<string | null>(null)
  const [resendSuccess, setResendSuccess] = useState(false)
  const [resendError, setResendError] = useState<string | null>(null)

  // Check if this is a verification callback
  useEffect(() => {
    const handleVerification = async () => {
      const token = searchParams.get('token')
      const type = searchParams.get('type')

      if (token && type === 'signup') {
        setIsVerifying(true)
        try {
          const { error } = await supabase.auth.verifyOtp({
            token_hash: token,
            type: 'signup',
          })

          if (error) throw error

          setVerificationSuccess(true)

          // Redirect to login after 3 seconds
          setTimeout(() => {
            router.push('/login?verified=true')
          }, 3000)
        } catch (error: any) {
          console.error('Verification error:', error)
          setVerificationError(error.message || t('failedError'))
        } finally {
          setIsVerifying(false)
        }
      }
    }

    handleVerification()
  }, [searchParams, router])

  // Get email from URL parameter or local storage
  useEffect(() => {
    const emailParam = searchParams.get('email')
    if (emailParam) {
      setEmail(emailParam)
    } else {
      // Try to get from session storage (set during registration)
      const storedEmail = sessionStorage.getItem('pending_verification_email')
      if (storedEmail) {
        setEmail(storedEmail)
      }
    }
  }, [searchParams])

  const handleResendEmail = async () => {
    if (!email) {
      setResendError(t('resendEmailRequired'))
      return
    }

    try {
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email: email,
      })

      if (error) throw error

      setResendSuccess(true)
      setResendError(null)

      // Clear success message after 5 seconds
      setTimeout(() => {
        setResendSuccess(false)
      }, 5000)
    } catch (error: any) {
      console.error('Resend error:', error)
      setResendError(error.message || t('resendFailed'))
      setResendSuccess(false)
    }
  }

  // Show verification in progress
  if (isVerifying) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted px-4 sm:px-6 lg:px-8">
        <div className="max-w-md w-full space-y-8 text-center">
          <div>
            <div className="mx-auto flex items-center justify-center h-16 w-16">
              <svg
                className="animate-spin h-16 w-16 text-primary-text"
                xmlns="http://www.w3.org/2000/svg"
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
            </div>
            <h2 className="mt-6 text-center text-3xl font-bold tracking-tight text-foreground">
              {t('verifyingTitle')}
            </h2>
            <p className="mt-2 text-center text-sm text-muted-foreground">
              {t('verifyingSubtitle')}
            </p>
          </div>
        </div>
      </div>
    )
  }

  // Show verification success
  if (verificationSuccess) {
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
                  d="M5 13l4 4L19 7"
                />
              </svg>
            </div>
            <h2 className="mt-6 text-center text-3xl font-bold tracking-tight text-foreground">
              {t('verifiedTitle')}
            </h2>
            <p className="mt-2 text-center text-sm text-muted-foreground">
              {t('verifiedSubtitle')}
            </p>
          </div>

          <div className="rounded-md bg-success-bg p-4">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg
                  className="h-5 w-5 text-success-text"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                >
                  <path
                    fillRule="evenodd"
                    d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                    clipRule="evenodd"
                  />
                </svg>
              </div>
              <div className="ms-3">
                <p className="text-sm text-success-text">
                  {t('verifiedNotice')}
                </p>
              </div>
            </div>
          </div>

          <div className="text-center">
            <Link
              href="/login"
              className="font-medium text-primary-text hover:text-primary-text/80"
            >
              {t('goToLoginNow')}
            </Link>
          </div>
        </div>
      </div>
    )
  }

  // Show verification error
  if (verificationError) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted px-4 sm:px-6 lg:px-8">
        <div className="max-w-md w-full space-y-8">
          <div>
            <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-danger-bg">
              <svg
                className="h-6 w-6 text-danger-text"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </div>
            <h2 className="mt-6 text-center text-3xl font-bold tracking-tight text-foreground">
              {t('failedTitle')}
            </h2>
            <p className="mt-2 text-center text-sm text-muted-foreground">
              {t('failedSubtitle')}
            </p>
          </div>

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
                <p className="text-sm text-danger-text">{verificationError}</p>
              </div>
            </div>
          </div>

          <div className="flex gap-3">
            <CmxButton
              type="button"
              onClick={handleResendEmail}
              className="flex-1"
            >
              {t('resendButton')}
            </CmxButton>
            <Link
              href="/login"
              className="flex-1 flex justify-center rounded-md border border-border bg-card py-2 px-4 text-sm font-medium text-foreground hover:bg-muted focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
            >
              {t('backToLogin')}
            </Link>
          </div>
        </div>
      </div>
    )
  }

  // Default: Show verification notice
  return (
    <div className="min-h-screen flex items-center justify-center bg-muted px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        {/* Header */}
        <div>
          <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-info-bg">
            <svg
              className="h-6 w-6 text-primary-text"
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
            {t('noticeTitle')}
          </h2>
          {email && (
            <p className="mt-2 text-center text-sm text-muted-foreground">
              {t('noticeBody', { email })}
            </p>
          )}
        </div>

        {/* Success message for resend */}
        {resendSuccess && (
          <div className="rounded-md bg-success-bg p-4">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg
                  className="h-5 w-5 text-success-text"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                >
                  <path
                    fillRule="evenodd"
                    d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                    clipRule="evenodd"
                  />
                </svg>
              </div>
              <div className="ms-3">
                <p className="text-sm text-success-text">
                  {t('resendSuccess')}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Error message for resend */}
        {resendError && (
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
                <p className="text-sm text-danger-text">{resendError}</p>
              </div>
            </div>
          </div>
        )}

        {/* Instructions */}
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
              <h3 className="text-sm font-medium text-primary-text">{t('whatsNext')}</h3>
              <div className="mt-2 text-sm text-primary-text">
                <ol className="list-decimal list-inside space-y-1">
                  <li>{t('step1')}</li>
                  <li>{t('step2')}</li>
                  <li>{t('step3')}</li>
                </ol>
              </div>
            </div>
          </div>
        </div>

        {/* Resend option */}
        <div className="rounded-md bg-muted p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <svg
                className="h-5 w-5 text-muted-foreground"
                viewBox="0 0 20 20"
                fill="currentColor"
              >
                <path
                  fillRule="evenodd"
                  d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                  clipRule="evenodd"
                />
              </svg>
              <span className="ms-2 text-sm text-foreground">{t('didntReceive')}</span>
            </div>
            <CmxButton
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleResendEmail}
            >
              {t('resendShort')}
            </CmxButton>
          </div>
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
      </div>
    </div>
  )
}

/**
 *
 */
export default function VerifyEmailPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        </div>
      }
    >
      <VerifyEmailContent />
    </Suspense>
  )
}
