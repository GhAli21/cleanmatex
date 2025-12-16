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
import { supabase } from '@/lib/supabase/client'

function VerifyEmailContent() {
  const router = useRouter()
  const searchParams = useSearchParams()

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
          setVerificationError(error.message || 'Verification failed')
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
      setResendError('Email address is required')
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
      setResendError(error.message || 'Failed to resend verification email')
      setResendSuccess(false)
    }
  }

  // Show verification in progress
  if (isVerifying) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4 sm:px-6 lg:px-8">
        <div className="max-w-md w-full space-y-8 text-center">
          <div>
            <div className="mx-auto flex items-center justify-center h-16 w-16">
              <svg
                className="animate-spin h-16 w-16 text-blue-600"
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
            <h2 className="mt-6 text-center text-3xl font-bold tracking-tight text-gray-900">
              Verifying your email...
            </h2>
            <p className="mt-2 text-center text-sm text-gray-600">
              Please wait while we verify your email address
            </p>
          </div>
        </div>
      </div>
    )
  }

  // Show verification success
  if (verificationSuccess) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4 sm:px-6 lg:px-8">
        <div className="max-w-md w-full space-y-8">
          <div>
            <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-green-100">
              <svg
                className="h-6 w-6 text-green-600"
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
            <h2 className="mt-6 text-center text-3xl font-bold tracking-tight text-gray-900">
              Email Verified!
            </h2>
            <p className="mt-2 text-center text-sm text-gray-600">
              Your email has been successfully verified
            </p>
          </div>

          <div className="rounded-md bg-green-50 p-4">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg
                  className="h-5 w-5 text-green-400"
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
              <div className="ml-3">
                <p className="text-sm text-green-800">
                  You can now sign in with your credentials. Redirecting to login page...
                </p>
              </div>
            </div>
          </div>

          <div className="text-center">
            <Link
              href="/login"
              className="font-medium text-blue-600 hover:text-blue-500"
            >
              Go to Login Now
            </Link>
          </div>
        </div>
      </div>
    )
  }

  // Show verification error
  if (verificationError) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4 sm:px-6 lg:px-8">
        <div className="max-w-md w-full space-y-8">
          <div>
            <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-red-100">
              <svg
                className="h-6 w-6 text-red-600"
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
            <h2 className="mt-6 text-center text-3xl font-bold tracking-tight text-gray-900">
              Verification Failed
            </h2>
            <p className="mt-2 text-center text-sm text-gray-600">
              We couldn't verify your email address
            </p>
          </div>

          <div className="rounded-md bg-red-50 p-4">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg
                  className="h-5 w-5 text-red-400"
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
              <div className="ml-3">
                <p className="text-sm text-red-800">{verificationError}</p>
              </div>
            </div>
          </div>

          <div className="flex gap-3">
            <button
              onClick={handleResendEmail}
              className="flex-1 flex justify-center rounded-md border border-transparent bg-blue-600 py-2 px-4 text-sm font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
            >
              Resend Verification Email
            </button>
            <Link
              href="/login"
              className="flex-1 flex justify-center rounded-md border border-gray-300 bg-white py-2 px-4 text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
            >
              Back to Login
            </Link>
          </div>
        </div>
      </div>
    )
  }

  // Default: Show verification notice
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        {/* Header */}
        <div>
          <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-blue-100">
            <svg
              className="h-6 w-6 text-blue-600"
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
          <h2 className="mt-6 text-center text-3xl font-bold tracking-tight text-gray-900">
            Verify your email
          </h2>
          {email && (
            <p className="mt-2 text-center text-sm text-gray-600">
              We sent a verification email to <strong>{email}</strong>
            </p>
          )}
        </div>

        {/* Success message for resend */}
        {resendSuccess && (
          <div className="rounded-md bg-green-50 p-4">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg
                  className="h-5 w-5 text-green-400"
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
              <div className="ml-3">
                <p className="text-sm text-green-800">
                  Verification email sent successfully! Check your inbox.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Error message for resend */}
        {resendError && (
          <div className="rounded-md bg-red-50 p-4">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg
                  className="h-5 w-5 text-red-400"
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
              <div className="ml-3">
                <p className="text-sm text-red-800">{resendError}</p>
              </div>
            </div>
          </div>
        )}

        {/* Instructions */}
        <div className="rounded-md bg-blue-50 p-4">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg
                className="h-5 w-5 text-blue-400"
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
            <div className="ml-3">
              <h3 className="text-sm font-medium text-blue-800">What's next?</h3>
              <div className="mt-2 text-sm text-blue-700">
                <ol className="list-decimal list-inside space-y-1">
                  <li>Check your email inbox (and spam folder)</li>
                  <li>Click the verification link in the email</li>
                  <li>Return here to sign in</li>
                </ol>
              </div>
            </div>
          </div>
        </div>

        {/* Resend option */}
        <div className="rounded-md bg-gray-50 p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <svg
                className="h-5 w-5 text-gray-400"
                viewBox="0 0 20 20"
                fill="currentColor"
              >
                <path
                  fillRule="evenodd"
                  d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                  clipRule="evenodd"
                />
              </svg>
              <span className="ml-2 text-sm text-gray-700">Didn't receive the email?</span>
            </div>
            <button
              onClick={handleResendEmail}
              className="text-sm font-medium text-blue-600 hover:text-blue-500"
            >
              Resend
            </button>
          </div>
        </div>

        {/* Back to login */}
        <div className="text-center">
          <Link
            href="/login"
            className="font-medium text-blue-600 hover:text-blue-500"
          >
            ← Back to Login
          </Link>
        </div>
      </div>
    </div>
  )
}

export default function VerifyEmailPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      }
    >
      <VerifyEmailContent />
    </Suspense>
  )
}
