'use client'

/**
 * PRD-003: Upgrade Profile Modal
 * Convert stub customer to full profile with OTP verification
 */

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { useRTL } from '@/lib/hooks/useRTL'
import { upgradeCustomerProfile, sendOTP, verifyOTP } from '@/lib/api/customers'
import type { Customer } from '@/lib/types/customer'

interface UpgradeProfileModalProps {
  customer: Customer
  onClose: () => void
  onSuccess: (updatedCustomer: Customer) => void
}

type Step = 'confirm' | 'otp' | 'details'

export default function UpgradeProfileModal({
  customer,
  onClose,
  onSuccess,
}: UpgradeProfileModalProps) {
  const t = useTranslations('customers.upgradeProfile')
  const tCustomers = useTranslations('customers')
  const tOTP = useTranslations('customers.otp')
  const tCommon = useTranslations('common')
  const isRTL = useRTL()
  
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
              <p className={`text-sm text-gray-600 ${isRTL ? 'text-right' : 'text-left'}`}>
                {t('willEnable')}
              </p>
              <ul className={`mt-3 space-y-2 text-sm text-gray-600 ${isRTL ? 'text-right' : 'text-left'}`}>
                <li className={`flex items-start ${isRTL ? 'flex-row-reverse' : ''}`}>
                  <svg
                    className={`h-5 w-5 text-green-500 flex-shrink-0 ${isRTL ? 'ml-2' : 'mr-2'}`}
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
                <li className={`flex items-start ${isRTL ? 'flex-row-reverse' : ''}`}>
                  <svg
                    className={`h-5 w-5 text-green-500 flex-shrink-0 ${isRTL ? 'ml-2' : 'mr-2'}`}
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
                <li className={`flex items-start ${isRTL ? 'flex-row-reverse' : ''}`}>
                  <svg
                    className={`h-5 w-5 text-green-500 flex-shrink-0 ${isRTL ? 'ml-2' : 'mr-2'}`}
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
                <li className={`flex items-start ${isRTL ? 'flex-row-reverse' : ''}`}>
                  <svg
                    className={`h-5 w-5 text-green-500 flex-shrink-0 ${isRTL ? 'ml-2' : 'mr-2'}`}
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

              <div className={`mt-4 p-3 bg-blue-50 rounded-md ${isRTL ? 'text-right' : 'text-left'}`}>
                <p className="text-sm text-blue-800">
                  <strong>{t('phoneVerificationRequired')}</strong> {t('willSendCodeTo')}{' '}
                  <span className="font-mono">{customer.phone}</span>
                </p>
              </div>
            </div>

            <div className={`px-6 py-4 bg-gray-50 flex items-center ${isRTL ? 'flex-row-reverse justify-start space-x-reverse space-x-3' : 'justify-end space-x-3'}`}>
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
              >
                {tCommon('cancel')}
              </button>
              <button
                type="button"
                onClick={handleSendOTP}
                disabled={loading}
                className={`px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 ${isRTL ? 'flex-row-reverse' : ''}`}
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
                <div className={`mb-4 bg-red-50 ${isRTL ? 'border-r-4 border-l-0' : 'border-l-4 border-r-0'} border-red-400 p-4`}>
                  <p className={`text-sm text-red-800 ${isRTL ? 'text-right' : 'text-left'}`}>{error}</p>
                </div>
              )}

              <p className={`text-sm text-gray-600 mb-4 ${isRTL ? 'text-right' : 'text-left'}`}>
                {tOTP('enter6DigitCode')}{' '}
                <span className="font-mono font-medium">{customer.phone}</span>
              </p>

              <div className="mb-4">
                <label className={`block text-sm font-medium text-gray-700 mb-2 ${isRTL ? 'text-right' : 'text-left'}`}>
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
                  className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm text-center text-2xl font-mono tracking-widest focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              <div className="mb-4">
                <label className={`block text-sm font-medium text-gray-700 mb-2 ${isRTL ? 'text-right' : 'text-left'}`}>
                  {tCustomers('emailOptional')}
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  dir="ltr"
                  placeholder="customer@example.com"
                  className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              {resendCooldown > 0 ? (
                <p className={`text-sm text-gray-500 ${isRTL ? 'text-right' : 'text-left'}`}>
                  {t('resendCodeIn')} {resendCooldown} {t('seconds')}
                </p>
              ) : (
                <button
                  type="button"
                  onClick={handleSendOTP}
                  className={`text-sm text-blue-600 hover:text-blue-800 ${isRTL ? 'text-right' : 'text-left'}`}
                >
                  {tOTP('resendVerificationCode')}
                </button>
              )}
            </div>

            <div className={`px-6 py-4 bg-gray-50 flex items-center ${isRTL ? 'flex-row-reverse justify-start space-x-reverse space-x-3' : 'justify-end space-x-3'}`}>
              <button
                type="button"
                onClick={() => setStep('confirm')}
                disabled={loading}
                className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
              >
                {tCommon('back')}
              </button>
              <button
                type="button"
                onClick={handleVerifyAndUpgrade}
                disabled={loading || otpCode.length !== 6}
                className={`px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 ${isRTL ? 'flex-row-reverse' : ''}`}
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
    <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200">
          <div className={`flex items-center ${isRTL ? 'flex-row-reverse justify-between' : 'justify-between'}`}>
            <h3 className="text-lg font-medium text-gray-900">
              {t('title')}
            </h3>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-500">
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
