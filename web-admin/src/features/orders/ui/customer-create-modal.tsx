/**
 * Customer Creation Modal for New Order Flow
 * Allows creating customers directly from the order creation process
 * PRD-010: New Order UI
 */

'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { useRTL } from '@/lib/hooks/useRTL';
import { CmxButton, CmxInput, CmxSelect, Label } from '@ui/primitives';
import {
  CmxDialog,
  CmxDialogContent,
  CmxDialogDescription,
  CmxDialogFooter,
  CmxDialogHeader,
  CmxDialogTitle,
} from '@ui/overlays';
import { createCustomer } from '@/lib/api/customers';
import { getPhoneCountryCodeAction } from '@/app/actions/tenant/get-phone-country-code';
import { useFeatureOptional } from '@/src/features/auth/ui/RequireFeature';
import { FEATURE_FLAG_KEYS } from '@/lib/constants/feature-flags';
import type { CustomerType, Customer } from '@/lib/types/customer';

/** Common GCC + regional country codes for phone input */
const COUNTRY_CODES = [
  { code: '+968', label: 'Oman', flag: '🇴🇲' },
  { code: '+966', label: 'Saudi Arabia', flag: '🇸🇦' },
  { code: '+971', label: 'UAE', flag: '🇦🇪' },
  { code: '+965', label: 'Kuwait', flag: '🇰🇼' },
  { code: '+973', label: 'Bahrain', flag: '🇧🇭' },
  { code: '+974', label: 'Qatar', flag: '🇶🇦' },
  { code: '+20', label: 'Egypt', flag: '🇪🇬' },
  { code: '+962', label: 'Jordan', flag: '🇯🇴' },
  { code: '+961', label: 'Lebanon', flag: '🇱🇧' },
];

interface CustomerCreateModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess: (customer: Customer) => void;
  tenantId?: string;
}

/**
 *
 * @param root0
 * @param root0.open
 * @param root0.onClose
 * @param root0.onSuccess
 * @param root0.tenantId
 */
export function CustomerCreateModal({
  open,
  onClose,
  onSuccess,
  tenantId,
}: CustomerCreateModalProps) {
  const t = useTranslations('customers');
  const tB2b = useTranslations('b2b');
  const tCommon = useTranslations('common');
  const isRTL = useRTL();
  // Only check B2B feature access when the create-customer modal is actually open.
  const hasB2B = useFeatureOptional(open ? FEATURE_FLAG_KEYS.B2B_CONTRACTS : undefined);
  const [customerType, setCustomerType] = useState<CustomerType>('stub');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');
  const [countryCode, setCountryCode] = useState('+968');
  const [email, setEmail] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [companyName2, setCompanyName2] = useState('');
  const [taxId, setTaxId] = useState('');
  const [creditLimit, setCreditLimit] = useState('');
  const [paymentTermsDays, setPaymentTermsDays] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch tenant default phone country code when modal opens
  useEffect(() => {
    if (open && tenantId) {
      getPhoneCountryCodeAction(tenantId).then((code) => {
        const found = COUNTRY_CODES.find((c) => c.code === code);
        setCountryCode(found ? code : '+968');
      }).catch(() => { /* keep default */ });
    }
  }, [open, tenantId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validation
    if (!firstName.trim()) {
      setError(t('firstNameRequired') || 'First name is required');
      return;
    }

    if (customerType !== 'guest' && !phone.trim()) {
      setError(t('phoneRequiredStubFull') || 'Phone number is required for stub customers');
      return;
    }

    if (customerType === 'b2b' && !companyName.trim()) {
      setError(tB2b('companyName') ? `${tB2b('companyName')} is required` : 'Company name is required');
      return;
    }

    setLoading(true);

    try {
      let createdCustomer: Customer;

      // For stub customers (most common POS use case)
      if (customerType === 'stub') {
        const fullPhone = phone.trim().startsWith('+') ? phone.trim() : `${countryCode}${phone.replace(/\D/g, '')}`;
        createdCustomer = await createCustomer({
          type: 'stub',
          firstName: firstName.trim(),
          lastName: lastName.trim() || undefined,
          phone: fullPhone,
        });
      }
      // For guest customers
      else if (customerType === 'guest') {
        createdCustomer = await createCustomer({
          type: 'guest',
          firstName: firstName.trim(),
          lastName: lastName.trim() || undefined,
        });
      }
      // For B2B customers (when feature enabled)
      else if (customerType === 'b2b') {
        const fullPhone = phone.trim().startsWith('+') ? phone.trim() : `${countryCode}${phone.replace(/\D/g, '')}`;
        createdCustomer = await createCustomer({
          type: 'b2b',
          firstName: firstName.trim(),
          lastName: lastName.trim() || undefined,
          phone: fullPhone,
          email: email.trim() || undefined,
          companyName: companyName.trim(),
          companyName2: companyName2.trim() || undefined,
          taxId: taxId.trim() || undefined,
          creditLimit: creditLimit ? Number(creditLimit) : undefined,
          paymentTermsDays: paymentTermsDays ? Number(paymentTermsDays) : undefined,
        });
      }
      // For full customers (requires OTP - not implemented in simple modal)
      else {
        setError(t('fullCustomerRequiresOTP') || 'Full customer requires OTP verification');
        setLoading(false);
        return;
      }

      // Reset loading state before calling onSuccess
      // (onSuccess will handle closing the modal and searching for the customer)
      setLoading(false);

      // Reset form
      setFirstName('');
      setLastName('');
      setPhone('');
      setEmail('');
      setCompanyName('');
      setCompanyName2('');
      setTaxId('');
      setCreditLimit('');
      setPaymentTermsDays('');
      setError(null);

      // Call success callback with created customer
      onSuccess(createdCustomer);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : (t('failedToCreateCustomer') || 'Failed to create customer');
      setError(errorMessage);
      setLoading(false);
    }
  };

  const handleClose = () => {
    if (loading) return; // Prevent closing while loading
    
    // Reset form on close
    setFirstName('');
    setLastName('');
    setPhone('');
    setEmail('');
    setCompanyName('');
    setCompanyName2('');
    setTaxId('');
    setCreditLimit('');
    setPaymentTermsDays('');
    setError(null);
    setCustomerType('stub');
    onClose();
  };

  return (
    <CmxDialog open={open} onOpenChange={(next) => { if (!next && !loading) handleClose(); }} stackAboveModals>
      <CmxDialogContent className="max-w-md w-full p-0" scrollBody>
        <CmxDialogHeader>
          <CmxDialogTitle>
            {t('quickAddCustomer') || 'Create New Customer'}
          </CmxDialogTitle>
          <CmxDialogDescription>
            {t('createQuickProfile') || 'Create a quick customer profile for this order'}
          </CmxDialogDescription>
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
            <Label className="mb-2 block text-start">
              {t('customerType') || 'Customer Type'}
            </Label>
            <div className={`grid gap-3 ${hasB2B ? 'grid-cols-3' : 'grid-cols-2'}`}>
              <CmxButton
                type="button"
                variant={customerType === 'guest' ? 'primary' : 'secondary'}
                size="sm"
                onClick={() => setCustomerType('guest')}
                disabled={loading}
              >
                {t('types.guest') || 'Guest'}
              </CmxButton>
              <CmxButton
                type="button"
                variant={customerType === 'stub' ? 'primary' : 'secondary'}
                size="sm"
                onClick={() => setCustomerType('stub')}
                disabled={loading}
              >
                {t('stubRecommended') || 'Stub (Recommended)'}
              </CmxButton>
              {hasB2B && (
                <CmxButton
                  type="button"
                  variant={customerType === 'b2b' ? 'primary' : 'secondary'}
                  size="sm"
                  onClick={() => setCustomerType('b2b')}
                  disabled={loading}
                >
                  {tB2b('customer') || 'B2B'}
                </CmxButton>
              )}
            </div>
            <p className="mt-1 text-xs text-muted-foreground text-start">
              {customerType === 'guest'
                ? t('quickCheckout') || 'Quick checkout without phone'
                : t('orderTracking') || 'Allows order tracking via phone'}
            </p>
          </div>

          {/* First Name */}
          <div className="mb-4">
            <Label htmlFor="create-customer-firstName" className="mb-1 block text-start">
              {t('firstName') || 'First Name'} <span className="text-danger-text">*</span>
            </Label>
            <CmxInput
              type="text"
              id="create-customer-firstName"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              dir={isRTL ? 'rtl' : 'ltr'}
              disabled={loading}
              placeholder={t('firstName') || 'First Name'}
              required
            />
          </div>

          {/* Last Name */}
          <div className="mb-4">
            <Label htmlFor="create-customer-lastName" className="mb-1 block text-start">
              {t('lastName') || 'Last Name'}
            </Label>
            <CmxInput
              type="text"
              id="create-customer-lastName"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              dir={isRTL ? 'rtl' : 'ltr'}
              disabled={loading}
              placeholder={t('lastName') || 'Last Name'}
            />
          </div>

          {/* Phone (for stub customers) */}
          {customerType !== 'guest' && (
            <div className="mb-4">
              <Label htmlFor="create-customer-phone" className="mb-1 block text-start">
                {t('phoneNumber') || 'Phone Number'} <span className="text-danger-text">*</span>
              </Label>
              <div className="flex gap-2" dir="ltr">
                <div className="w-28 shrink-0">
                  <CmxSelect
                    aria-label={t('countryCode') || 'Country code'}
                    value={countryCode}
                    onChange={(e) => setCountryCode(e.target.value)}
                    disabled={loading}
                    options={COUNTRY_CODES.map((c) => ({
                      value: c.code,
                      label: `${c.flag} ${c.code}`,
                    }))}
                  />
                </div>
                <CmxInput
                  type="tel"
                  id="create-customer-phone"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  dir="ltr"
                  disabled={loading}
                  className="flex-1 tabular-nums"
                  placeholder="90123456"
                  required
                />
              </div>
            </div>
          )}

          {/* Email (optional for stub, required-ish for B2B) */}
          {(customerType === 'stub' || customerType === 'b2b') && (
            <div className="mb-4">
              <Label htmlFor="create-customer-email" className="mb-1 block text-start">
                {customerType === 'b2b' ? (t('email') || 'Email') : (t('emailOptional') || 'Email (Optional)')}
              </Label>
              <CmxInput
                type="email"
                id="create-customer-email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                dir="ltr"
                disabled={loading}
                placeholder="customer@example.com"
              />
            </div>
          )}

          {/* B2B fields */}
          {customerType === 'b2b' && (
            <>
              <div className="mb-4">
                <Label htmlFor="create-customer-companyName" className="mb-1 block text-start">
                  {tB2b('companyName') || 'Company Name'} <span className="text-danger-text">*</span>
                </Label>
                <CmxInput
                  type="text"
                  id="create-customer-companyName"
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  dir={isRTL ? 'rtl' : 'ltr'}
                  disabled={loading}
                  placeholder={tB2b('companyName') || 'Company Name'}
                />
              </div>
              <div className="mb-4">
                <Label htmlFor="create-customer-companyName2" className="mb-1 block text-start">
                  {tB2b('companyName2') || 'Company Name (Arabic)'}
                </Label>
                <CmxInput
                  type="text"
                  id="create-customer-companyName2"
                  value={companyName2}
                  onChange={(e) => setCompanyName2(e.target.value)}
                  dir="rtl"
                  disabled={loading}
                  className="text-end"
                  placeholder={tB2b('companyName2') || 'Company Name (Arabic)'}
                />
              </div>
              <div className="mb-4">
                <Label htmlFor="create-customer-taxId" className="mb-1 block text-start">
                  {tB2b('taxId') || 'Tax ID'}
                </Label>
                <CmxInput
                  type="text"
                  id="create-customer-taxId"
                  value={taxId}
                  onChange={(e) => setTaxId(e.target.value)}
                  dir="ltr"
                  disabled={loading}
                  placeholder={tB2b('taxId') || 'Tax ID'}
                />
              </div>
              <div className="mb-4 grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="create-customer-creditLimit" className="mb-1 block text-start">
                    {tB2b('creditLimit') || 'Credit Limit'}
                  </Label>
                  <CmxInput
                    type="number"
                    id="create-customer-creditLimit"
                    value={creditLimit}
                    onChange={(e) => setCreditLimit(e.target.value)}
                    dir="ltr"
                    disabled={loading}
                    min={0}
                    step={0.01}
                    className="tabular-nums"
                    placeholder="0"
                  />
                </div>
                <div>
                  <Label htmlFor="create-customer-paymentTermsDays" className="mb-1 block text-start">
                    {tB2b('paymentTermsDays') || 'Payment Terms (Days)'}
                  </Label>
                  <CmxInput
                    type="number"
                    id="create-customer-paymentTermsDays"
                    value={paymentTermsDays}
                    onChange={(e) => setPaymentTermsDays(e.target.value)}
                    dir="ltr"
                    disabled={loading}
                    min={0}
                    className="tabular-nums"
                    placeholder="30"
                  />
                </div>
              </div>
            </>
          )}

          {/* Actions */}
          <CmxDialogFooter className="mt-6">
            <CmxButton
              type="button"
              variant="outline"
              onClick={handleClose}
              disabled={loading}
            >
              {tCommon('cancel')}
            </CmxButton>
            <CmxButton
              type="submit"
              variant="primary"
              loading={loading}
              disabled={loading}
            >
              {loading ? (t('creating') || 'Creating...') : (t('addCustomer') || 'Add Customer')}
            </CmxButton>
          </CmxDialogFooter>
        </form>
      </CmxDialogContent>
    </CmxDialog>
  );
}
