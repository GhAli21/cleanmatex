/**
 * PRD-003: Customer Creation Modal
 * Quick customer creation for POS workflow (stub, guest, B2B)
 */

'use client'
/* eslint-disable react-hooks/set-state-in-effect */

import { useState, useEffect } from 'react'
import { useTranslations } from 'next-intl'
import { useRTL } from '@/lib/hooks/useRTL'
import { CmxButton, CmxInput, CmxSelect, Label } from '@ui/primitives'
import { CmxPhoneInput } from '@ui/forms'
import {
  CmxDialog,
  CmxDialogContent,
  CmxDialogDescription,
  CmxDialogFooter,
  CmxDialogHeader,
  CmxDialogTitle,
} from '@ui/overlays'
import { useMessage } from '@ui/feedback'
import { createCustomer } from '@/lib/api/customers'
import { fetchCustomerCategories, type CustomerCategoryItem } from '@/lib/api/customer-categories'
import { useFeature } from '@/src/features/auth/ui/RequireFeature'
import { FEATURE_FLAG_KEYS } from '@/lib/constants/feature-flags'
import type { CustomerType } from '@/lib/types/customer'

interface CustomerCreateModalProps {
  open?: boolean
  onClose: () => void
  onSuccess: () => void
  /** When true, hide B2B type option (e.g. /dashboard/customers - guest/stub/walk_in only) */
  hideB2B?: boolean
}

/**
 *
 * @param root0
 * @param root0.open
 * @param root0.onClose
 * @param root0.onSuccess
 * @param root0.hideB2B
 */
export default function CustomerCreateModal({
  open = true,
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
    <CmxDialog open={open} onOpenChange={(next) => { if (!next) onClose() }} stackAboveModals>
      <CmxDialogContent className="max-w-md w-full p-0" scrollBody>
        <CmxDialogHeader>
          <CmxDialogTitle>{t('quickAddCustomer')}</CmxDialogTitle>
          <CmxDialogDescription>{t('createQuickProfile')}</CmxDialogDescription>
        </CmxDialogHeader>

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
            <Label className="mb-2 block text-start">{t('customerType')}</Label>
            <div className={`grid gap-3 ${hasB2B ? 'grid-cols-3' : 'grid-cols-2'}`}>
              <CmxButton
                type="button"
                variant={customerType === 'guest' ? 'primary' : 'secondary'}
                size="sm"
                onClick={() => { setCustomerType('guest'); setCategoryId(''); }}
              >
                {t('types.guest')}
              </CmxButton>
              <CmxButton
                type="button"
                variant={customerType === 'stub' ? 'primary' : 'secondary'}
                size="sm"
                onClick={() => { setCustomerType('stub'); setCategoryId(''); }}
              >
                {t('stubRecommended')}
              </CmxButton>
              {hasB2B && !hideB2B && (
                <CmxButton
                  type="button"
                  variant={customerType === 'b2b' ? 'primary' : 'secondary'}
                  size="sm"
                  onClick={() => { setCustomerType('b2b'); setCategoryId(''); }}
                >
                  {t('types.b2b')}
                </CmxButton>
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
            <Label htmlFor="firstName" className="mb-1 block text-start">
              {t('firstName')} <span className="text-danger-text">*</span>
            </Label>
            <CmxInput
              type="text"
              id="firstName"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              dir={isRTL ? 'rtl' : 'ltr'}
              placeholder={t('firstName')}
              required
            />
          </div>

          {/* Last Name */}
          <div className="mb-4">
            <Label htmlFor="lastName" className="mb-1 block text-start">
              {t('lastName')}
            </Label>
            <CmxInput
              type="text"
              id="lastName"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              dir={isRTL ? 'rtl' : 'ltr'}
              placeholder={t('lastName')}
            />
          </div>

          {/* Phone (for stub & B2B customers) */}
          {customerType !== 'guest' && (
            <div className="mb-4">
              <Label htmlFor="phone" className="mb-1 block text-start">
                {t('phoneNumber')} <span className="text-danger-text">*</span>
              </Label>
              <CmxPhoneInput
                id="phone"
                value={phone}
                onChange={(e164) => setPhone(e164)}
                disabled={loading}
                required
              />
            </div>
          )}

          {/* Email (optional for stub, optional for B2B) */}
          {(customerType === 'stub' || customerType === 'b2b') && (
            <div className="mb-4">
              <Label htmlFor="email" className="mb-1 block text-start">
                {t('emailOptional')}
              </Label>
              <CmxInput
                type="email"
                id="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                dir="ltr"
                placeholder="customer@example.com"
              />
            </div>
          )}

          {/* B2B Category Dropdown */}
          {customerType === 'b2b' && hasB2B && b2bCategories.length > 0 && (
            <div className="mb-4">
              <Label htmlFor="categoryId" className="mb-1 block text-start">
                B2B Category <span className="text-danger-text">*</span>
              </Label>
              <CmxSelect
                id="categoryId"
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
                required
                options={[
                  { value: '', label: 'Select category' },
                  ...b2bCategories.map((c) => ({ value: c.id, label: c.name })),
                ]}
              />
            </div>
          )}

          {/* Individual Category (optional for guest/stub) */}
          {(customerType === 'guest' || customerType === 'stub') && individualCategories.length > 0 && (
            <div className="mb-4">
              <Label htmlFor="categoryIdIndividual" className="mb-1 block text-start">
                Customer Category
              </Label>
              <CmxSelect
                id="categoryIdIndividual"
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
                options={[
                  { value: '', label: 'Select category (optional)' },
                  ...individualCategories.map((c) => ({ value: c.id, label: c.name })),
                ]}
              />
            </div>
          )}

          {/* B2B Company Fields */}
          {customerType === 'b2b' && (
            <>
              <div className="mb-4">
                <Label htmlFor="companyName" className="mb-1 block text-start">
                  {tB2b('companyName')} <span className="text-danger-text">*</span>
                </Label>
                <CmxInput
                  type="text"
                  id="companyName"
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  dir={isRTL ? 'rtl' : 'ltr'}
                  placeholder={tB2b('companyName')}
                  required
                />
              </div>
              <div className="mb-4">
                <Label htmlFor="companyName2" className="mb-1 block text-start">
                  {tB2b('companyName')} (AR)
                </Label>
                <CmxInput
                  type="text"
                  id="companyName2"
                  value={companyName2}
                  onChange={(e) => setCompanyName2(e.target.value)}
                  dir="rtl"
                  className="text-end"
                  placeholder={tB2b('companyName')}
                />
              </div>
              <div className="mb-4">
                <Label htmlFor="taxId" className="mb-1 block text-start">
                  {tB2b('taxId')}
                </Label>
                <CmxInput
                  type="text"
                  id="taxId"
                  value={taxId}
                  onChange={(e) => setTaxId(e.target.value)}
                  dir="ltr"
                  placeholder={tB2b('taxId')}
                />
              </div>
              <div className="grid grid-cols-2 gap-3 mb-4">
                <div>
                  <Label htmlFor="creditLimit" className="mb-1 block text-start">
                    {tB2b('creditLimit')}
                  </Label>
                  <CmxInput
                    type="number"
                    id="creditLimit"
                    value={creditLimit}
                    onChange={(e) => setCreditLimit(e.target.value)}
                    min="0"
                    step="0.01"
                    dir="ltr"
                    className="tabular-nums"
                    placeholder="0"
                  />
                </div>
                <div>
                  <Label htmlFor="paymentTermsDays" className="mb-1 block text-start">
                    {tB2b('paymentTermsDays')}
                  </Label>
                  <CmxInput
                    type="number"
                    id="paymentTermsDays"
                    value={paymentTermsDays}
                    onChange={(e) => setPaymentTermsDays(e.target.value)}
                    min="0"
                    dir="ltr"
                    className="tabular-nums"
                    placeholder="30"
                  />
                </div>
              </div>
            </>
          )}

          {/* Actions */}
          <CmxDialogFooter className="mt-6">
            <CmxButton type="button" variant="outline" onClick={onClose} disabled={loading}>
              {tCommon('cancel')}
            </CmxButton>
            <CmxButton type="submit" variant="primary" loading={loading} disabled={loading}>
              {loading ? t('creating') : t('addCustomer')}
            </CmxButton>
          </CmxDialogFooter>
        </form>
      </CmxDialogContent>
    </CmxDialog>
  )
}
