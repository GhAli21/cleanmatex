'use client'

/**
 * Registration Page
 *
 * User registration with email, password, and display name
 * Supports bilingual (EN/AR) and RTL layout
 */

import { useState, FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { useAuth } from '@/lib/auth/auth-context'
import { validateRegisterForm } from '@/lib/auth/validation'
import type { FormErrors } from '@/types/auth'
import { CmxButton, CmxCheckbox, CmxInput, Label } from '@ui/primitives'

/**
 *
 */
export default function RegisterPage() {
  const router = useRouter()
  const { signUp, isLoading } = useAuth()
  const t = useTranslations('auth.register')

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [errors, setErrors] = useState<FormErrors>({})
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [registrationComplete, setRegistrationComplete] = useState(false)

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()

    // Validate form
    const validationErrors = validateRegisterForm(email, password, confirmPassword, displayName)
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors)
      return
    }

    setErrors({})

    try {
      await signUp(email, password, displayName)
      setRegistrationComplete(true)
    } catch (error: any) {
      console.error('Registration error:', error)
      setErrors({
        general: error.message || t('failed'),
      })
    }
  }

  // Show success message after registration
  if (registrationComplete) {
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
              {t('successTitle')}
            </h2>
            <p className="mt-2 text-center text-sm text-muted-foreground">
              {t('successBody', { email })}
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
                  </ol>
                </div>
              </div>
            </div>
          </div>

          <div className="text-center">
            <Link
              href="/login"
              className="font-medium text-primary-text hover:text-primary-text/80"
            >
              {t('goToLogin')}
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

          <div className="space-y-4 rounded-md shadow-sm">
            {/* Display Name Field */}
            <div>
              <Label htmlFor="displayName" className="block mb-1">
                {t('fullNameLabel')}
              </Label>
              <CmxInput
                id="displayName"
                name="displayName"
                type="text"
                required
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                error={errors.displayName}
                placeholder={t('fullNamePlaceholder')}
              />
            </div>

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

            {/* Password Field */}
            <div>
              <Label htmlFor="password" className="block mb-1">
                {t('passwordLabel')}
              </Label>
              <div className="relative">
                <CmxInput
                  id="password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="new-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className={errors.password ? 'border-danger-border pe-10' : 'pe-10'}
                  placeholder={t('passwordPlaceholder')}
                />
                <CmxButton
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute inset-y-0 end-0 h-full px-3"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? t('hidePassword') : t('showPassword')}
                >
                  {showPassword ? (
                    <svg className="h-5 w-5 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                    </svg>
                  ) : (
                    <svg className="h-5 w-5 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                  )}
                </CmxButton>
              </div>
              {errors.password && (
                <p className="mt-1 text-sm text-danger-text">{errors.password}</p>
              )}
              <p className="mt-1 text-xs text-muted-foreground">
                {t('passwordHint')}
              </p>
            </div>

            {/* Confirm Password Field */}
            <div>
              <Label htmlFor="confirmPassword" className="block mb-1">
                {t('confirmPasswordLabel')}
              </Label>
              <div className="relative">
                <CmxInput
                  id="confirmPassword"
                  name="confirmPassword"
                  type={showConfirmPassword ? 'text' : 'password'}
                  autoComplete="new-password"
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className={errors.confirmPassword ? 'border-danger-border pe-10' : 'pe-10'}
                  placeholder={t('confirmPasswordPlaceholder')}
                />
                <CmxButton
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute inset-y-0 end-0 h-full px-3"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  aria-label={showConfirmPassword ? t('hideConfirmPassword') : t('showConfirmPassword')}
                >
                  {showConfirmPassword ? (
                    <svg className="h-5 w-5 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                    </svg>
                  ) : (
                    <svg className="h-5 w-5 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                  )}
                </CmxButton>
              </div>
              {errors.confirmPassword && (
                <p className="mt-1 text-sm text-danger-text">{errors.confirmPassword}</p>
              )}
            </div>
          </div>

          {/* Terms & Conditions */}
          <div className="flex items-start">
            <CmxCheckbox
              id="terms"
              name="terms"
              required
              size="sm"
              label={(
                <span className="text-sm font-medium text-foreground">
                  {t('termsAgreement')}{' '}
                  <Link href="/terms" className="text-primary-text hover:text-primary-text/80">
                    {t('termsOfService')}
                  </Link>{' '}
                  ·{' '}
                  <Link href="/privacy" className="text-primary-text hover:text-primary-text/80">
                    {t('privacyPolicy')}
                  </Link>
                </span>
              )}
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
              {isLoading ? t('creatingAccount') : t('createAccount')}
            </CmxButton>
          </div>

          {/* Sign in link */}
          <div className="text-center">
            <p className="text-sm text-muted-foreground">
              {t('alreadyHaveAccount')}{' '}
              <Link
                href="/login"
                className="font-medium text-primary-text hover:text-primary-text/80"
              >
                {t('signIn')}
              </Link>
            </p>
          </div>
        </form>
      </div>
    </div>
  )
}
