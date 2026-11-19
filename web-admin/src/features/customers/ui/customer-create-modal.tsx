/**
 * PRD-003: Customer Creation Modal
 * Quick customer creation for POS workflow (stub, guest, B2B)
 */

'use client'
/* eslint-disable react-hooks/set-state-in-effect */

import { useState, useEffect } from 'react'
import { useTranslations } from 'next-intl'
import { useRTL } from '@/lib/hooks/useRTL'
import { useMessage } from '@ui/feedback'
import { createCustomer } from '@/lib/api/customers'
import { fetchCustomerCategories, type CustomerCategoryItem } from '@/lib/api/customer-categories'
import { useFeature } from '@/src/features/auth/ui/RequireFeature'
import { FEATURE_FLAG_KEYS } from '@/lib/constants/feature-flags'
import type { CustomerType } from '@/lib/types/customer'

interface CustomerCreateModalProps {
  onClose: () => void
  onSuccess: () => void
  /** When true, hide B2B type option (e.g. /dashboard/customers - guest/stub/walk_in only) */
  hideB2B?: boolean
}

/**
 *
 * @param root0
 * @param root0.onClose
 * @param root0.onSuccess
 * @param root0.hideB2B
 */
export default function CustomerCreateModal({
  onClose,
  onSuccess,
  hideB2B = false,
}: CustomerCreateModalProps) {
  const t = useTranslations('customers')
  const tB2b = useTranslations('b2b')
  const tCommon = useTranslations('common')
  const isRTL = useRTL()
  const { showErrorFrom } = useMessage()
  const hasB2B = useFeature(FEATURE_FLAG_KEYS.B2B_CONTRACTS)
  const [customerType, setCustomerType] = useState<CustomerType>('stub')
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [companyName, setCompanyName] = useState('')
  const [companyName2, setCompanyName2] = useState('')
  const [taxId, setTaxId] = useState('')
  const [creditLimit, setCreditLimit] = useState('')
  const [paymentTermsDays, setPaymentTermsDays] = useState('')
  const [categoryId, setCategoryId] = useState<string>('')
  const [b2bCategories, setB2bCategories] = useState<CustomerCategoryItem[]>([])
  const [individualCategories, setIndividualCategories] = useState<CustomerCategoryItem[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Fetch B2B categories when B2B type is available
  useEffect(() => {
    if (!hideB2B && hasB2B) {
      fetchCustomerCategories({ is_b2b: true, active_only: true, system_type: 'b2b' })
        .then(setB2bCategories)
        .catch(() => setB2bCategories([]))
    } else {
      setB2bCategories([])
    }
  }, [hideB2B, hasB2B])

  // Fetch individual categories filtered by selected customer type (guest, stub, walk_in)
  useEffect(() => {
    if (customerType === 'b2b') {
      setIndividualCategories([])
      return
    }
    const sysType = customerType === 'full' ? 'walk_in' : customerType
    fetchCustomerCategories({ is_b2b: false, active_only: true, system_type: sysType })
      .then(setIndividualCategories)
      .catch(() => setIndividualCategories([]))
  }, [customerType])

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

    if (customerType === 'b2b' && !companyName.trim()) {
      setError(tB2b('companyName') ? `${tB2b('companyName')} is required` : 'Company name is required')
      return
    }

    if (customerType === 'b2b' && hasB2B && b2bCategories.length > 0 && !categoryId) {
      setError('Please select a B2B category')
      return
    }

    setLoading(true)

    try {
      if (customerType === 'stub') {
        await createCustomer({
          type: 'stub',
          firstName: firstName.trim(),
          lastName: lastName.trim() || undefined,
          phone: phone.trim(),
          categoryId: categoryId || undefined,
        })
      } else if (customerType === 'guest') {
        await createCustomer({
          type: 'guest',
          firstName: firstName.trim(),
          lastName: lastName.trim() || undefined,
        })
      } else if (customerType === 'b2b') {
        await createCustomer({
          type: 'b2b',
          firstName: firstName.trim(),
          lastName: lastName.trim() || undefined,
          phone: phone.trim(),
          email: email.trim() || undefined,
          companyName: companyName.trim(),
          companyName2: companyName2.trim() || undefined,
          taxId: taxId.trim() || undefined,
          creditLimit: creditLimit ? Number(creditLimit) : undefined,
          paymentTermsDays: paymentTermsDays ? Number(paymentTermsDays) : undefined,
          categoryId: categoryId || undefined,
        })
      } else {
        setError(t('fullCustomerRequiresOTP'))
        setLoading(false)
        return
      }

      onSuccess()
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : t('failedToCreateCustomer')
      setError(errorMsg)
      showErrorFrom(err, { fallback: t('failedToCreateCustomer') })
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/75 flex items-center justify-center z-50">
      <div className="bg-card rounded-lg shadow-xl max-w-md w-full mx-4">
        {/* Header */}
        <div className="px-6 py-4 border-b border-border">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-medium text-foreground">
              {t('quickAddCustomer')}
            </h3>
            <button
              onClick={onClose}
              className="text-muted-foreground hover:text-foreground"
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
          <p className="mt-1 text-sm text-muted-foreground text-start">
            {t('createQuickProfile')}
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="px-6 py-4">
          {/* Error Message */}
          {error && (
            <div className="mb-4 bg-danger-bg border-s-4 border-e-0 border-destructive p-4">
              <div className="flex">
                <div className="flex-shrink-0">
                  <svg
                    className="h-5 w-5 text-danger-text"
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
                <div className="ms-3">
                  <p className="text-sm text-danger-text">{error}</p>
                </div>
              </div>
            </div>
          )}

          {/* Customer Type Selection */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-foreground mb-2 text-start">
              {t('customerType')}
            </label>
            <div className={`grid gap-3 ${hasB2B ? 'grid-cols-3' : 'grid-cols-2'}`}>
              <button
                type="button"
                onClick={() => { setCustomerType('guest'); setCategoryId(''); }}
                className={`px-4 py-2 text-sm font-medium rounded-md ${
                  customerType === 'guest'
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted text-foreground hover:bg-border'
                }`}
              >
                {t('types.guest')}
              </button>
              <button
                type="button"
                onClick={() => { setCustomerType('stub'); setCategoryId(''); }}
                className={`px-4 py-2 text-sm font-medium rounded-md ${
                  customerType === 'stub'
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted text-foreground hover:bg-border'
                }`}
              >
                {t('stubRecommended')}
              </button>
              {hasB2B && !hideB2B && (
                <button
                  type="button"
                  onClick={() => { setCustomerType('b2b'); setCategoryId(''); }}
                  className={`px-4 py-2 text-sm font-medium rounded-md ${
                    customerType === 'b2b'
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted text-foreground hover:bg-border'
                  }`}
                >
                  {t('types.b2b')}
                </button>
              )}
            </div>
            <p className="mt-1 text-xs text-muted-foreground text-start">
              {customerType === 'guest'
                ? t('quickCheckout')
                : customerType === 'b2b'
                  ? (tB2b('companyName') || 'Company / corporate customer')
                  : t('orderTracking')}
            </p>
          </div>

          {/* First Name */}
          <div className="mb-4">
            <label
              htmlFor="firstName"
              className="block text-sm font-medium text-foreground mb-1 text-start"
            >
              {t('firstName')} <span className="text-danger-text">*</span>
            </label>
            <input
              type="text"
              id="firstName"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              dir={isRTL ? 'rtl' : 'ltr'}
              className="block w-full px-3 py-2 border border-border rounded-md shadow-sm focus:outline-none focus:ring-ring focus:border-ring sm:text-sm text-start"
              placeholder={t('firstName')}
              required
            />
          </div>

          {/* Last Name */}
          <div className="mb-4">
            <label
              htmlFor="lastName"
              className="block text-sm font-medium text-foreground mb-1 text-start"
            >
              {t('lastName')}
            </label>
            <input
              type="text"
              id="lastName"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              dir={isRTL ? 'rtl' : 'ltr'}
              className="block w-full px-3 py-2 border border-border rounded-md shadow-sm focus:outline-none focus:ring-ring focus:border-ring sm:text-sm text-start"
              placeholder={t('lastName')}
            />
          </div>

          {/* Phone (for stub customers) */}
          {customerType !== 'guest' && (
            <div className="mb-4">
              <label
                htmlFor="phone"
                className="block text-sm font-medium text-foreground mb-1 text-start"
              >
                {t('phoneNumber')} <span className="text-danger-text">*</span>
              </label>
              <div className="flex">
                <span className="inline-flex items-center px-3 rounded-s-md border-s border-e-0 border border-border bg-muted text-muted-foreground text-sm">
                  +968
                </span>
                <input
                  type="tel"
                  id="phone"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  dir="ltr"
                  className="flex-1 block w-full px-3 py-2 border border-border rounded-e-md shadow-sm focus:outline-none focus:ring-ring focus:border-ring sm:text-sm"
                  placeholder="90123456"
                  required
                />
              </div>
            </div>
          )}

          {/* Email (optional for stub, optional for B2B) */}
          {(customerType === 'stub' || customerType === 'b2b') && (
            <div className="mb-4">
              <label
                htmlFor="email"
                className="block text-sm font-medium text-foreground mb-1 text-start"
              >
                {t('emailOptional')}
              </label>
              <input
                type="email"
                id="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                dir="ltr"
                className="block w-full px-3 py-2 border border-border rounded-md shadow-sm focus:outline-none focus:ring-ring focus:border-ring sm:text-sm text-start"
                placeholder="customer@example.com"
              />
            </div>
          )}

          {/* B2B Category Dropdown */}
          {customerType === 'b2b' && hasB2B && b2bCategories.length > 0 && (
            <div className="mb-4">
              <label
                htmlFor="categoryId"
                className="block text-sm font-medium text-foreground mb-1 text-start"
              >
                B2B Category <span className="text-danger-text">*</span>
              </label>
              <select
                id="categoryId"
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
                required
                className="block w-full px-3 py-2 border border-border rounded-md shadow-sm focus:outline-none focus:ring-ring focus:border-ring sm:text-sm text-start"
              >
                <option value="">Select category</option>
                {b2bCategories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Individual Category (optional for guest/stub) */}
          {(customerType === 'guest' || customerType === 'stub') && individualCategories.length > 0 && (
            <div className="mb-4">
              <label
                htmlFor="categoryIdIndividual"
                className="block text-sm font-medium text-foreground mb-1 text-start"
              >
                Customer Category
              </label>
              <select
                id="categoryIdIndividual"
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
                className="block w-full px-3 py-2 border border-border rounded-md shadow-sm focus:outline-none focus:ring-ring focus:border-ring sm:text-sm text-start"
              >
                <option value="">Select category (optional)</option>
                {individualCategories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* B2B Company Fields */}
          {customerType === 'b2b' && (
            <>
              <div className="mb-4">
                <label
                  htmlFor="companyName"
                  className="block text-sm font-medium text-foreground mb-1 text-start"
                >
                  {tB2b('companyName')} <span className="text-danger-text">*</span>
                </label>
                <input
                  type="text"
                  id="companyName"
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  dir={isRTL ? 'rtl' : 'ltr'}
                  className="block w-full px-3 py-2 border border-border rounded-md shadow-sm focus:outline-none focus:ring-ring focus:border-ring sm:text-sm text-start"
                  placeholder={tB2b('companyName')}
                  required
                />
              </div>
              <div className="mb-4">
                <label
                  htmlFor="companyName2"
                  className="block text-sm font-medium text-foreground mb-1 text-start"
                >
                  {tB2b('companyName')} (AR)
                </label>
                <input
                  type="text"
                  id="companyName2"
                  value={companyName2}
                  onChange={(e) => setCompanyName2(e.target.value)}
                  dir="rtl"
                  className="block w-full px-3 py-2 border border-border rounded-md shadow-sm focus:outline-none focus:ring-ring focus:border-ring sm:text-sm text-end"
                  placeholder={tB2b('companyName')}
                />
              </div>
              <div className="mb-4">
                <label
                  htmlFor="taxId"
                  className="block text-sm font-medium text-foreground mb-1 text-start"
                >
                  {tB2b('taxId')}
                </label>
                <input
                  type="text"
                  id="taxId"
                  value={taxId}
                  onChange={(e) => setTaxId(e.target.value)}
                  dir="ltr"
                  className="block w-full px-3 py-2 border border-border rounded-md shadow-sm focus:outline-none focus:ring-ring focus:border-ring sm:text-sm text-start"
                  placeholder={tB2b('taxId')}
                />
              </div>
              <div className="grid grid-cols-2 gap-3 mb-4">
                <div>
                  <label
                    htmlFor="creditLimit"
                    className="block text-sm font-medium text-foreground mb-1 text-start"
                  >
                    {tB2b('creditLimit')}
                  </label>
                  <input
                    type="number"
                    id="creditLimit"
                    value={creditLimit}
                    onChange={(e) => setCreditLimit(e.target.value)}
                    min="0"
                    step="0.01"
                    dir="ltr"
                    className="block w-full px-3 py-2 border border-border rounded-md shadow-sm focus:outline-none focus:ring-ring focus:border-ring sm:text-sm text-start"
                    placeholder="0"
                  />
                </div>
                <div>
                  <label
                    htmlFor="paymentTermsDays"
                    className="block text-sm font-medium text-foreground mb-1 text-start"
                  >
                    {tB2b('paymentTermsDays')}
                  </label>
                  <input
                    type="number"
                    id="paymentTermsDays"
                    value={paymentTermsDays}
                    onChange={(e) => setPaymentTermsDays(e.target.value)}
                    min="0"
                    dir="ltr"
                    className="block w-full px-3 py-2 border border-border rounded-md shadow-sm focus:outline-none focus:ring-ring focus:border-ring sm:text-sm text-start"
                    placeholder="30"
                  />
                </div>
              </div>
            </>
          )}

          {/* Actions */}
          <div className="mt-6 flex items-center justify-end space-x-3">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-4 py-2 border border-border rounded-md shadow-sm text-sm font-medium text-foreground bg-card hover:bg-muted focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-ring disabled:opacity-50"
            >
              {tCommon('cancel')}
            </button>
            <button
              type="submit"
              disabled={loading}
              className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-primary-foreground bg-primary hover:bg-primary-hover focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-ring disabled:opacity-50"
            >
              {loading ? (
                <>
                  <svg
                    className="animate-spin h-4 w-4 text-on-solid -ms-1 me-2"
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
