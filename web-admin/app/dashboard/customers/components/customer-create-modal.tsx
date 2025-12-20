/**
 * PRD-003: Customer Creation Modal
 * Quick customer creation for POS workflow (stub customers)
 */

'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { useRTL } from '@/lib/hooks/useRTL'
import { createCustomer } from '@/lib/api/customers'
import type { CustomerType } from '@/lib/types/customer'

interface CustomerCreateModalProps {
  onClose: () => void
  onSuccess: () => void
}

export default function CustomerCreateModal({
  onClose,
  onSuccess,
}: CustomerCreateModalProps) {
  const t = useTranslations('customers')
  const tCommon = useTranslations('common')
  const isRTL = useRTL()
  const [customerType, setCustomerType] = useState<CustomerType>('stub')
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    // Validation
    if (!firstName.trim()) {
      setError(t('firstNameRequired'))
      return
    }

    if (customerType !== 'guest' && !phone.trim()) {
      setError(t('phoneRequiredStubFull'))
      return
    }

    setLoading(true)

    try {
      // For stub customers (most common POS use case)
      if (customerType === 'stub') {
        await createCustomer({
          type: 'stub',
          firstName: firstName.trim(),
          lastName: lastName.trim() || undefined,
          phone: phone.trim(),
        })
      }
      // For guest customers
      else if (customerType === 'guest') {
        await createCustomer({
          type: 'guest',
          firstName: firstName.trim(),
          lastName: lastName.trim() || undefined,
        })
      }
      // For full customers (requires OTP - not implemented in simple modal)
      else {
        setError(t('fullCustomerRequiresOTP'))
        setLoading(false)
        return
      }

      onSuccess()
    } catch (err) {
      setError(err instanceof Error ? err.message : t('failedToCreateCustomer'))
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200">
          <div className={`flex items-center ${isRTL ? 'flex-row-reverse justify-between' : 'justify-between'}`}>
            <h3 className="text-lg font-medium text-gray-900">
              {t('quickAddCustomer')}
            </h3>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-500"
            >
              <svg
                className="h-6 w-6"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>
          <p className={`mt-1 text-sm text-gray-500 ${isRTL ? 'text-right' : 'text-left'}`}>
            {t('createQuickProfile')}
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="px-6 py-4">
          {/* Error Message */}
          {error && (
            <div className={`mb-4 bg-red-50 ${isRTL ? 'border-r-4 border-l-0' : 'border-l-4 border-r-0'} border-red-400 p-4`}>
              <div className={`flex ${isRTL ? 'flex-row-reverse' : ''}`}>
                <div className="flex-shrink-0">
                  <svg
                    className="h-5 w-5 text-red-400"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path
                      fillRule="evenodd"
                      d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                      clipRule="evenodd"
                    />
                  </svg>
                </div>
                <div className={isRTL ? 'mr-3' : 'ml-3'}>
                  <p className="text-sm text-red-800">{error}</p>
                </div>
              </div>
            </div>
          )}

          {/* Customer Type Selection */}
          <div className="mb-4">
            <label className={`block text-sm font-medium text-gray-700 mb-2 ${isRTL ? 'text-right' : 'text-left'}`}>
              {t('customerType')}
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setCustomerType('guest')}
                className={`px-4 py-2 text-sm font-medium rounded-md ${
                  customerType === 'guest'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {t('types.guest')}
              </button>
              <button
                type="button"
                onClick={() => setCustomerType('stub')}
                className={`px-4 py-2 text-sm font-medium rounded-md ${
                  customerType === 'stub'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {t('stubRecommended')}
              </button>
            </div>
            <p className={`mt-1 text-xs text-gray-500 ${isRTL ? 'text-right' : 'text-left'}`}>
              {customerType === 'guest'
                ? t('quickCheckout')
                : t('orderTracking')}
            </p>
          </div>

          {/* First Name */}
          <div className="mb-4">
            <label
              htmlFor="firstName"
              className={`block text-sm font-medium text-gray-700 mb-1 ${isRTL ? 'text-right' : 'text-left'}`}
            >
              {t('firstName')} <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              id="firstName"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              dir={isRTL ? 'rtl' : 'ltr'}
              className={`block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm ${isRTL ? 'text-right' : 'text-left'}`}
              placeholder={t('firstName')}
              required
            />
          </div>

          {/* Last Name */}
          <div className="mb-4">
            <label
              htmlFor="lastName"
              className={`block text-sm font-medium text-gray-700 mb-1 ${isRTL ? 'text-right' : 'text-left'}`}
            >
              {t('lastName')}
            </label>
            <input
              type="text"
              id="lastName"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              dir={isRTL ? 'rtl' : 'ltr'}
              className={`block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm ${isRTL ? 'text-right' : 'text-left'}`}
              placeholder={t('lastName')}
            />
          </div>

          {/* Phone (for stub customers) */}
          {customerType !== 'guest' && (
            <div className="mb-4">
              <label
                htmlFor="phone"
                className={`block text-sm font-medium text-gray-700 mb-1 ${isRTL ? 'text-right' : 'text-left'}`}
              >
                {t('phoneNumber')} <span className="text-red-500">*</span>
              </label>
              <div className={`flex ${isRTL ? 'flex-row-reverse' : ''}`}>
                <span className={`inline-flex items-center px-3 ${isRTL ? 'rounded-r-md border-r border-l-0' : 'rounded-l-md border-l border-r-0'} border border-gray-300 bg-gray-50 text-gray-500 text-sm`}>
                  +968
                </span>
                <input
                  type="tel"
                  id="phone"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  dir="ltr"
                  className={`flex-1 block w-full px-3 py-2 border border-gray-300 ${isRTL ? 'rounded-l-md' : 'rounded-r-md'} shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm`}
                  placeholder="90123456"
                  required
                />
              </div>
            </div>
          )}

          {/* Email (optional for stub) */}
          {customerType === 'stub' && (
            <div className="mb-4">
              <label
                htmlFor="email"
                className={`block text-sm font-medium text-gray-700 mb-1 ${isRTL ? 'text-right' : 'text-left'}`}
              >
                {t('emailOptional')}
              </label>
              <input
                type="email"
                id="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                dir="ltr"
                className={`block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm ${isRTL ? 'text-right' : 'text-left'}`}
                placeholder="customer@example.com"
              />
            </div>
          )}

          {/* Actions */}
          <div className={`mt-6 flex items-center ${isRTL ? 'flex-row-reverse justify-start space-x-reverse space-x-3' : 'justify-end space-x-3'}`}>
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
            >
              {tCommon('cancel')}
            </button>
            <button
              type="submit"
              disabled={loading}
              className={`inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 ${isRTL ? 'flex-row-reverse' : ''}`}
            >
              {loading ? (
                <>
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
                  {t('creating')}
                </>
              ) : (
                t('addCustomer')
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
