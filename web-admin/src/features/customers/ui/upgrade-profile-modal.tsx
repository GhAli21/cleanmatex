'use client'

/**
 * PRD-003: Upgrade Profile Modal
 * Convert stub customer to full profile with OTP verification
 */

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { upgradeCustomerProfile, sendOTP, verifyOTP } from '@/lib/api/customers'
import type { Customer } from '@/lib/types/customer'

interface UpgradeProfileModalProps {
  customer: Customer
  onClose: () => void
  onSuccess: (updatedCustomer: Customer) => void
}

type Step = 'confirm' | 'otp' | 'details'

/**
 *
 * @param root0
 * @param root0.customer
 * @param root0.onClose
 * @param root0.onSuccess
 */
export default function UpgradeProfileModal({
  customer,
  onClose,
  onSuccess,
}: UpgradeProfileModalProps) {
  const t = useTranslations('customers.upgradeProfile')
  const tCustomers = useTranslations('customers')
  const tOTP = useTranslations('customers.otp')
  const tCommon = useTranslations('common')
  
  const [step, setStep] = useState<Step>('confirm')
  const [email, setEmail] = useState(customer.email || '')
  const [otpCode, setOtpCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [otpSent, setOtpSent] = useState(false)
  const [resendCooldown, setResendCooldown] = useState(0)

  const handleSendOTP = async () => {
    if (!customer.phone) {
      setError(t('customerMustHavePhone'))
      return
    }

    setLoading(true)
    setError(null)

    try {
      await sendOTP({ phone: customer.phone, purpose: 'verification' })
      setOtpSent(true)
      setStep('otp')

      // Start cooldown
      setResendCooldown(60)
      const interval = setInterval(() => {
        setResendCooldown((prev) => {
          if (prev <= 1) {
            clearInterval(interval)
            return 0
          }
          return prev - 1
        })
      }, 1000)
    } catch (err) {
      setError(err instanceof Error ? err.message : t('failedToSendOTP'))
    } finally {
      setLoading(false)
    }
  }

  const handleVerifyAndUpgrade = async () => {
    if (!otpCode || otpCode.length !== 6) {
      setError(t('enterValid6DigitCode'))
      return
    }

    setLoading(true)
    setError(null)

    try {
      // Upgrade profile
      const upgraded = await upgradeCustomerProfile(customer.id, {
        email: email || undefined,
        otpCode,
        preferences: {},
      })

      onSuccess(upgraded)
    } catch (err) {
      setError(err instanceof Error ? err.message : t('failedToUpgrade'))
      setLoading(false)
    }
  }

  const renderStepContent = () => {
    switch (step) {
      case 'confirm':
        return (
          <>
            <div className="px-6 py-4">
              <p className="text-sm text-muted-foreground text-start">
                {t('willEnable')}
              </p>
              <ul className="mt-3 space-y-2 text-sm text-muted-foreground text-start">
                <li className="flex items-start">
                  <svg
                    className="h-5 w-5 text-success-text flex-shrink-0 me-2"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path
                      fillRule="evenodd"
                      d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                      clipRule="evenodd"
                    />
                  </svg>
                  <span>{t('mobileAppAccess')}</span>
                </li>
                <li className="flex items-start">
                  <svg
                    className="h-5 w-5 text-success-text flex-shrink-0 me-2"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path
                      fillRule="evenodd"
                      d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                      clipRule="evenodd"
                    />
                  </svg>
                  <span>{t('loyaltyPointsRewards')}</span>
                </li>
                <li className="flex items-start">
                  <svg
                    className="h-5 w-5 text-success-text flex-shrink-0 me-2"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path
                      fillRule="evenodd"
                      d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                      clipRule="evenodd"
                    />
                  </svg>
                  <span>{t('savedPreferences')}</span>
                </li>
                <li className="flex items-start">
                  <svg
                    className="h-5 w-5 text-success-text flex-shrink-0 me-2"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path
                      fillRule="evenodd"
                      d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                      clipRule="evenodd"
                    />
                  </svg>
                  <span>{t('orderNotifications')}</span>
                </li>
              </ul>

              <div className="mt-4 p-3 bg-info-bg rounded-md text-start">
                <p className="text-sm text-primary-text">
                  <strong>{t('phoneVerificationRequired')}</strong> {t('willSendCodeTo')}{' '}
                  <span className="font-mono">{customer.phone}</span>
                </p>
              </div>
            </div>

            <div className="px-6 py-4 bg-muted flex items-center justify-end space-x-3">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 border border-border rounded-md shadow-sm text-sm font-medium text-foreground bg-card hover:bg-muted"
              >
                {tCommon('cancel')}
              </button>
              <button
                type="button"
                onClick={handleSendOTP}
                disabled={loading}
                className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-primary-foreground bg-primary hover:bg-primary-hover disabled:opacity-50"
              >
                {loading ? t('sending') : tOTP('sendVerificationCode')}
              </button>
            </div>
          </>
        )

      case 'otp':
        return (
          <>
            <div className="px-6 py-4">
              {error && (
                <div className="mb-4 bg-danger-bg border-s-4 border-e-0 border-destructive p-4">
                  <p className="text-sm text-danger-text text-start">{error}</p>
                </div>
              )}

              <p className="text-sm text-muted-foreground mb-4 text-start">
                {tOTP('enter6DigitCode')}{' '}
                <span className="font-mono font-medium">{customer.phone}</span>
              </p>

              <div className="mb-4">
                <label className="block text-sm font-medium text-foreground mb-2 text-start">
                  {t('verificationCode')}
                </label>
                <input
                  type="text"
                  value={otpCode}
                  onChange={(e) => {
                    const value = e.target.value.replace(/\D/g, '').slice(0, 6)
                    setOtpCode(value)
                    if (value.length === 6) {
                      setError(null)
                    }
                  }}
                  dir="ltr"
                  placeholder="000000"
                  maxLength={6}
                  className="block w-full px-3 py-2 border border-border rounded-md shadow-sm text-center text-2xl font-mono tracking-widest focus:outline-none focus:ring-ring focus:border-ring"
                />
              </div>

              <div className="mb-4">
                <label className="block text-sm font-medium text-foreground mb-2 text-start">
                  {tCustomers('emailOptional')}
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  dir="ltr"
                  placeholder="customer@example.com"
                  className="block w-full px-3 py-2 border border-border rounded-md shadow-sm focus:outline-none focus:ring-ring focus:border-ring"
                />
              </div>

              {resendCooldown > 0 ? (
                <p className="text-sm text-muted-foreground text-start">
                  {t('resendCodeIn')} {resendCooldown} {t('seconds')}
                </p>
              ) : (
                <button
                  type="button"
                  onClick={handleSendOTP}
                  className="text-sm text-primary-text hover:text-primary-text/80 text-start"
                >
                  {tOTP('resendVerificationCode')}
                </button>
              )}
            </div>

            <div className="px-6 py-4 bg-muted flex items-center justify-end space-x-3">
              <button
                type="button"
                onClick={() => setStep('confirm')}
                disabled={loading}
                className="px-4 py-2 border border-border rounded-md shadow-sm text-sm font-medium text-foreground bg-card hover:bg-muted"
              >
                {tCommon('back')}
              </button>
              <button
                type="button"
                onClick={handleVerifyAndUpgrade}
                disabled={loading || otpCode.length !== 6}
                className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-primary-foreground bg-primary hover:bg-primary-hover disabled:opacity-50"
              >
                {loading ? t('upgrading') : t('upgradeToFull')}
              </button>
            </div>
          </>
        )

      default:
        return null
    }
  }

  return (
    <div className="fixed inset-0 bg-black/75 flex items-center justify-center z-50">
      <div className="bg-card rounded-lg shadow-xl max-w-md w-full mx-4">
        {/* Header */}
        <div className="px-6 py-4 border-b border-border">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-medium text-foreground">
              {t('title')}
            </h3>
            <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
              <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>
        </div>

        {/* Step Content */}
        {renderStepContent()}
      </div>
    </div>
  )
}
