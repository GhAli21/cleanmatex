'use client'

/**
 * PRD-003: OTP Verification Modal Component
 *
 * Modal for phone verification via OTP
 * Features:
 * - Phone input with country code (+968 default)
 * - Send OTP button with 60s countdown
 * - 6-digit code input
 * - Resend functionality
 * - Verification status and error handling
 */

import { useState, useEffect, useRef } from 'react'
import { useTranslations } from 'next-intl'
import { useRTL } from '@/lib/hooks/useRTL'
import { sendOTP, verifyOTP } from '@/lib/api/customers'

interface OTPVerificationModalProps {
  phone?: string // Pre-filled phone number
  onClose: () => void
  onVerified: (token: string, phone: string) => void
  title?: string
  description?: string
}

export default function OTPVerificationModal({
  phone: initialPhone = '',
  onClose,
  onVerified,
  title,
  description,
}: OTPVerificationModalProps) {
  const t = useTranslations('customers.otp')
  const isRTL = useRTL()
  
  // State
  const [step, setStep] = useState<'phone' | 'code'>('phone')
  const [phone, setPhone] = useState(initialPhone)
  const [phoneError, setPhoneError] = useState('')
  const [code, setCode] = useState(['', '', '', '', '', ''])
  const [codeError, setCodeError] = useState('')
  const [loading, setLoading] = useState(false)
  const [countdown, setCountdown] = useState(0)
  const [expiresAt, setExpiresAt] = useState<string | null>(null)
  
  // Use translated defaults if title/description not provided
  const modalTitle = title || t('verifyPhoneNumber')
  const modalDescription = description || t('enterPhoneForCode')

  // Refs for OTP inputs
  const inputRefs = useRef<(HTMLInputElement | null)[]>([])

  // Countdown timer
  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000)
      return () => clearTimeout(timer)
    }
  }, [countdown])

  // Validate phone number
  const validatePhone = (): boolean => {
    if (!phone.trim()) {
      setPhoneError(t('phoneRequired'))
      return false
    }

    // Basic Oman phone validation (8 digits)
    const phoneDigits = phone.replace(/\D/g, '')
    if (phoneDigits.length !== 8) {
      setPhoneError(t('phoneMustBe8Digits'))
      return false
    }

    if (!phoneDigits.match(/^[79]\d{7}$/)) {
      setPhoneError(t('phoneMustStartWith7Or9'))
      return false
    }

    return true
  }

  // Handle send OTP
  const handleSendOTP = async () => {
    if (!validatePhone()) return

    setLoading(true)
    setPhoneError('')

    try {
      const fullPhone = `+968${phone.replace(/\D/g, '')}`
      const result = await sendOTP({ phone: fullPhone, purpose: 'verification' })

      setExpiresAt(result.expiresAt)
      setCountdown(60) // 60 seconds cooldown
      setStep('code')
      setCode(['', '', '', '', '', ''])

      // Focus first input
      setTimeout(() => {
        inputRefs.current[0]?.focus()
      }, 100)
    } catch (error) {
      setPhoneError(
        error instanceof Error ? error.message : t('failedToSendOTP')
      )
    } finally {
      setLoading(false)
    }
  }

  // Handle OTP input change
  const handleCodeChange = (index: number, value: string) => {
    // Only allow digits
    if (value && !/^\d$/.test(value)) return

    const newCode = [...code]
    newCode[index] = value
    setCode(newCode)
    setCodeError('')

    // Auto-focus next input
    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus()
    }

    // Auto-verify when all 6 digits entered
    if (newCode.every((digit) => digit) && index === 5) {
      handleVerifyOTP(newCode.join(''))
    }
  }

  // Handle backspace
  const handleKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !code[index] && index > 0) {
      inputRefs.current[index - 1]?.focus()
    }
  }

  // Handle paste
  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault()
    const pastedData = e.clipboardData.getData('text').replace(/\D/g, '')

    if (pastedData.length === 6) {
      const newCode = pastedData.split('')
      setCode(newCode)
      inputRefs.current[5]?.focus()

      // Auto-verify
      handleVerifyOTP(pastedData)
    }
  }

  // Handle verify OTP
  const handleVerifyOTP = async (codeString: string) => {
    setLoading(true)
    setCodeError('')

    try {
      const fullPhone = `+968${phone.replace(/\D/g, '')}`
      const result = await verifyOTP({
        phone: fullPhone,
        code: codeString,
      })

      if (result.verified && result.token) {
        onVerified(result.token, fullPhone)
      } else {
        setCodeError(result.message || t('invalidVerificationCode'))
        setCode(['', '', '', '', '', ''])
        inputRefs.current[0]?.focus()
      }
    } catch (error) {
      setCodeError(
        error instanceof Error ? error.message : t('verificationFailed')
      )
      setCode(['', '', '', '', '', ''])
      inputRefs.current[0]?.focus()
    } finally {
      setLoading(false)
    }
  }

  // Handle resend
  const handleResend = () => {
    if (countdown > 0) return
    setCode(['', '', '', '', '', ''])
    setCodeError('')
    handleSendOTP()
  }

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
        {/* Backdrop */}
        <div
          className="fixed inset-0 transition-opacity bg-gray-500 bg-opacity-75"
          onClick={onClose}
        />

        {/* Modal */}
        <div className={`inline-block align-bottom bg-white rounded-lg ${isRTL ? 'text-right' : 'text-left'} overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-md sm:w-full`}>
          {/* Header */}
          <div className="bg-gradient-to-r from-blue-500 to-blue-600 px-6 py-5">
            <div className={`flex items-center ${isRTL ? 'flex-row-reverse justify-between' : 'justify-between'}`}>
              <div className={`flex items-center ${isRTL ? 'flex-row-reverse space-x-reverse space-x-3' : 'space-x-3'}`}>
                <div className="flex-shrink-0">
                  <svg
                    className="h-8 w-8 text-white"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z"
                    />
                  </svg>
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-white">{modalTitle}</h3>
                  <p className="text-sm text-blue-100">{modalDescription}</p>
                </div>
              </div>
              <button onClick={onClose} className="text-white hover:text-blue-100">
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
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

          {/* Content */}
          <div className="px-6 py-6">
            {step === 'phone' ? (
              /* Phone Input Step */
              <div className="space-y-4">
                <div>
                  <label
                    htmlFor="phone"
                    className={`block text-sm font-medium text-gray-700 mb-2 ${isRTL ? 'text-right' : 'text-left'}`}
                  >
                    {t('phoneNumber')}
                  </label>
                  <div className={`flex items-center ${isRTL ? 'flex-row-reverse space-x-reverse space-x-2' : 'space-x-2'}`}>
                    <div className={`flex-shrink-0 px-3 py-2 bg-gray-100 border border-gray-300 ${isRTL ? 'rounded-r-md' : 'rounded-l-md'} text-gray-700 font-medium`}>
                      +968
                    </div>
                    <input
                      type="tel"
                      id="phone"
                      value={phone}
                      onChange={(e) => {
                        setPhone(e.target.value)
                        setPhoneError('')
                      }}
                      dir="ltr"
                      placeholder="90123456"
                      maxLength={8}
                      className={`flex-1 px-3 py-2 border ${isRTL ? 'rounded-l-md' : 'rounded-r-md'} focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                        phoneError ? 'border-red-500' : 'border-gray-300'
                      }`}
                    />
                  </div>
                  {phoneError && (
                    <p className={`mt-2 text-sm text-red-600 ${isRTL ? 'text-right' : 'text-left'}`}>{phoneError}</p>
                  )}
                  <p className={`mt-2 text-xs text-gray-500 ${isRTL ? 'text-right' : 'text-left'}`}>
                    {t('willSend6DigitCode')}
                  </p>
                </div>

                <button
                  onClick={handleSendOTP}
                  disabled={loading}
                  className={`w-full px-4 py-3 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed ${isRTL ? 'flex-row-reverse' : ''}`}
                >
                  {loading ? (
                    <span className={`flex items-center justify-center ${isRTL ? 'flex-row-reverse' : ''}`}>
                      <svg
                        className={`animate-spin h-4 w-4 text-white ${isRTL ? 'ml-2 -mr-1' : '-ml-1 mr-2'}`}
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
                      {t('sending')}
                    </span>
                  ) : (
                    t('sendVerificationCode')
                  )}
                </button>
              </div>
            ) : (
              /* Code Input Step */
              <div className="space-y-6">
                <div>
                  <div className={`${isRTL ? 'text-right' : 'text-center'} mb-6`}>
                    <p className="text-sm text-gray-600">
                      {t('enter6DigitCode')}
                    </p>
                    <p className="text-lg font-semibold text-gray-900">
                      +968 {phone}
                    </p>
                    <button
                      onClick={() => setStep('phone')}
                      className="mt-1 text-sm text-blue-600 hover:text-blue-700"
                    >
                      {t('changeNumber')}
                    </button>
                  </div>

                  {/* OTP Input */}
                  <div className={`flex ${isRTL ? 'flex-row-reverse justify-center space-x-reverse' : 'justify-center'} space-x-2 mb-4`}>
                    {code.map((digit, index) => (
                      <input
                        key={index}
                        ref={(el) => { inputRefs.current[index] = el }}
                        type="text"
                        inputMode="numeric"
                        maxLength={1}
                        value={digit}
                        onChange={(e) => handleCodeChange(index, e.target.value)}
                        onKeyDown={(e) => handleKeyDown(index, e)}
                        onPaste={index === 0 ? handlePaste : undefined}
                        dir="ltr"
                        className={`w-12 h-14 text-center text-2xl font-bold border-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                          codeError
                            ? 'border-red-500 bg-red-50'
                            : 'border-gray-300 bg-white'
                        }`}
                      />
                    ))}
                  </div>

                  {codeError && (
                    <div className={`bg-red-50 border ${isRTL ? 'border-r-4 border-l-0' : 'border-l-4 border-r-0'} border-red-200 rounded-md p-3 mb-4`}>
                      <p className={`text-sm text-red-800 ${isRTL ? 'text-right' : 'text-center'}`}>{codeError}</p>
                    </div>
                  )}

                  {loading && (
                    <div className={`${isRTL ? 'text-right' : 'text-center'}`}>
                      <div className={`inline-flex items-center text-sm text-gray-600 ${isRTL ? 'flex-row-reverse' : ''}`}>
                        <svg
                          className={`animate-spin h-4 w-4 text-blue-600 ${isRTL ? 'ml-2 -mr-1' : '-ml-1 mr-2'}`}
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
                        {t('verifying')}
                      </div>
                    </div>
                  )}
                </div>

                {/* Resend */}
                <div className={`${isRTL ? 'text-right' : 'text-center'} pt-4 border-t border-gray-200`}>
                  {countdown > 0 ? (
                    <p className="text-sm text-gray-500">
                      {t('resendCodeIn')}{' '}
                      <span className="font-semibold text-gray-700">{countdown}s</span>
                    </p>
                  ) : (
                    <button
                      onClick={handleResend}
                      className="text-sm font-medium text-blue-600 hover:text-blue-700"
                    >
                      {t('resendVerificationCode')}
                    </button>
                  )}
                </div>

                {expiresAt && (
                  <p className={`text-xs ${isRTL ? 'text-right' : 'text-center'} text-gray-400`}>
                    {t('codeExpiresIn5Minutes')}
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="bg-gray-50 px-6 py-3">
            <p className={`text-xs ${isRTL ? 'text-right' : 'text-center'} text-gray-500`}>
              {t('standardSMSRatesApply')}
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
