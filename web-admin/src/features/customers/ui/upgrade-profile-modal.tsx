'use client'

/**
 * PRD-003: Upgrade Profile Modal
 * Convert stub customer to full profile with OTP verification
 */

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { CmxButton, CmxInput, CmxSelect, Label } from '@ui/primitives'
import {
  CmxDialog,
  CmxDialogContent,
  CmxDialogFooter,
  CmxDialogHeader,
  CmxDialogTitle,
} from '@ui/overlays'
import { upgradeCustomerProfile, sendOTP } from '@/lib/api/customers'
import type { Customer } from '@/lib/types/customer'
import { OTP_SEND_ERROR, type OtpChannel } from '@/lib/constants/otp'
import { useOutboxDeliveryReport } from '@features/notifications/hooks/use-outbox-delivery-report'

interface UpgradeProfileModalProps {
  customer: Customer
  open?: boolean
  onClose: () => void
  onSuccess: (updatedCustomer: Customer) => void
}

type Step = 'confirm' | 'otp' | 'details'

/** Server refusal code → message key under customers.otp. */
const OTP_ERROR_KEYS: Record<string, string> = {
  [OTP_SEND_ERROR.INVALID_PHONE]: 'invalidPhone',
  [OTP_SEND_ERROR.COUNTRY_NOT_ALLOWED]: 'countryNotAllowed',
  [OTP_SEND_ERROR.EMAIL_REQUIRED]: 'emailRequired',
  [OTP_SEND_ERROR.CHANNEL_OFF]: 'channelOff',
  [OTP_SEND_ERROR.RATE_LIMITED]: 'rateLimited',
}
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/**
 *
 * @param root0
 * @param root0.customer
 * @param root0.open
 * @param root0.onClose
 * @param root0.onSuccess
 */
export default function UpgradeProfileModal({
  customer,
  open = true,
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
  const [channel, setChannel] = useState<OtpChannel>('SMS')
  const reportDelivery = useOutboxDeliveryReport()

  const handleSendOTP = async () => {
    if (!customer.phone) {
      setError(t('customerMustHavePhone'))
      return
    }

    if (channel === 'EMAIL' && !EMAIL_PATTERN.test(email.trim())) {
      setError(tOTP('emailRequired'))
      return
    }

    setLoading(true)
    setError(null)

    try {
      const sent = await sendOTP({
        phone: customer.phone,
        purpose: 'verification',
        channel,
        email: channel === 'EMAIL' ? email.trim() : undefined,
        customerId: customer.id,
      })
      // The code is queued; report when it is sent or failed, without blocking the code entry.
      void reportDelivery(sent.outboxId, {
        sent: tOTP('codeSent'),
        failed: tOTP('codeNotSent'),
        pending: tOTP('codeStillSending'),
      })
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
      const key = err instanceof Error ? OTP_ERROR_KEYS[err.message] : undefined
      setError(key ? tOTP(key) : t('failedToSendOTP'))
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

              <div className="mt-4 space-y-3">
                <CmxSelect
                  label={tOTP('sendCodeBy')}
                  value={channel}
                  onChange={(e) => {
                    setChannel(e.target.value as OtpChannel)
                    setError(null)
                  }}
                  options={[
                    { value: 'SMS', label: tOTP('channelSms') },
                    { value: 'WHATSAPP', label: tOTP('channelWhatsapp') },
                    { value: 'EMAIL', label: tOTP('channelEmail') },
                  ]}
                />
                {channel === 'EMAIL' && (
                  <div>
                    <Label htmlFor="upgrade-otp-email" className="mb-2 block text-start">
                      {tOTP('emailForCode')}
                    </Label>
                    <CmxInput
                      id="upgrade-otp-email"
                      type="email"
                      dir="ltr"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                    />
                  </div>
                )}
              </div>

              {error && (
                <div className="mt-4 bg-danger-bg border-s-4 border-e-0 border-destructive p-4" role="alert">
                  <p className="text-sm text-danger-text text-start">{error}</p>
                </div>
              )}

              <div className="mt-4 p-3 bg-info-bg rounded-md text-start">
                <p className="text-sm text-primary-text">
                  <strong>{t('phoneVerificationRequired')}</strong> {t('willSendCodeTo')}{' '}
                  <bdi dir="ltr" className="font-mono tabular-nums">{channel === 'EMAIL' ? email.trim() : customer.phone}</bdi>
                </p>
              </div>
            </div>

            <CmxDialogFooter className="px-6 py-4 bg-muted">
              <CmxButton type="button" variant="outline" onClick={onClose}>
                {tCommon('cancel')}
              </CmxButton>
              <CmxButton
                type="button"
                variant="primary"
                onClick={handleSendOTP}
                loading={loading}
                disabled={loading}
              >
                {loading ? t('sending') : tOTP('sendVerificationCode')}
              </CmxButton>
            </CmxDialogFooter>
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
                <bdi dir="ltr" className="font-mono font-medium tabular-nums">{customer.phone}</bdi>
              </p>

              <div className="mb-4">
                <Label htmlFor="upgrade-otp-code" className="mb-2 block text-start">
                  {t('verificationCode')}
                </Label>
                <CmxInput
                  id="upgrade-otp-code"
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
                  className="text-center text-2xl font-mono tracking-widest tabular-nums"
                />
              </div>

              <div className="mb-4">
                <Label htmlFor="upgrade-email" className="mb-2 block text-start">
                  {tCustomers('emailOptional')}
                </Label>
                <CmxInput
                  id="upgrade-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  dir="ltr"
                  placeholder="customer@example.com"
                />
              </div>

              {resendCooldown > 0 ? (
                <p className="text-sm text-muted-foreground text-start tabular-nums">
                  {t('resendCodeIn')} {resendCooldown} {t('seconds')}
                </p>
              ) : (
                <CmxButton
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={handleSendOTP}
                  className="px-0"
                >
                  {tOTP('resendVerificationCode')}
                </CmxButton>
              )}
            </div>

            <CmxDialogFooter className="px-6 py-4 bg-muted">
              <CmxButton
                type="button"
                variant="outline"
                onClick={() => setStep('confirm')}
                disabled={loading}
              >
                {tCommon('back')}
              </CmxButton>
              <CmxButton
                type="button"
                variant="primary"
                onClick={handleVerifyAndUpgrade}
                loading={loading}
                disabled={loading || otpCode.length !== 6}
              >
                {loading ? t('upgrading') : t('upgradeToFull')}
              </CmxButton>
            </CmxDialogFooter>
          </>
        )

      default:
        return null
    }
  }

  return (
    <CmxDialog open={open} onOpenChange={(next) => { if (!next) onClose() }}>
      <CmxDialogContent className="max-w-md w-full p-0">
        <CmxDialogHeader>
          <CmxDialogTitle>{t('title')}</CmxDialogTitle>
        </CmxDialogHeader>

        {/* Step Content */}
        {renderStepContent()}
      </CmxDialogContent>
    </CmxDialog>
  )
}
