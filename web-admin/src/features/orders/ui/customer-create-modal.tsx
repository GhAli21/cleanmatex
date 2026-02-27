/**
 * Customer Creation Modal for New Order Flow
 * Allows creating customers directly from the order creation process
 * PRD-010: New Order UI
 */

'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { useRTL } from '@/lib/hooks/useRTL';
import { createCustomer } from '@/lib/api/customers';
import { getPhoneCountryCodeAction } from '@/app/actions/tenant/get-phone-country-code';
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

export function CustomerCreateModal({
  open,
  onClose,
  onSuccess,
  tenantId,
}: CustomerCreateModalProps) {
  const t = useTranslations('customers');
  const tCommon = useTranslations('common');
  const isRTL = useRTL();
  const [customerType, setCustomerType] = useState<CustomerType>('stub');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');
  const [countryCode, setCountryCode] = useState('+968');
  const [email, setEmail] = useState('');
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
    setError(null);
    setCustomerType('stub');
    onClose();
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60] p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200">
          <div className={`flex items-center ${isRTL ? 'flex-row-reverse justify-between' : 'justify-between'}`}>
            <h3 className="text-lg font-medium text-gray-900">
              {t('quickAddCustomer') || 'Create New Customer'}
            </h3>
            <button
              onClick={handleClose}
              disabled={loading}
              className="text-gray-400 hover:text-gray-500 disabled:opacity-50"
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
            {t('createQuickProfile') || 'Create a quick customer profile for this order'}
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
              {t('customerType') || 'Customer Type'}
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setCustomerType('guest')}
                disabled={loading}
                className={`px-4 py-2 text-sm font-medium rounded-md transition-colors disabled:opacity-50 ${
                  customerType === 'guest'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {t('types.guest') || 'Guest'}
              </button>
              <button
                type="button"
                onClick={() => setCustomerType('stub')}
                disabled={loading}
                className={`px-4 py-2 text-sm font-medium rounded-md transition-colors disabled:opacity-50 ${
                  customerType === 'stub'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {t('stubRecommended') || 'Stub (Recommended)'}
              </button>
            </div>
            <p className={`mt-1 text-xs text-gray-500 ${isRTL ? 'text-right' : 'text-left'}`}>
              {customerType === 'guest'
                ? t('quickCheckout') || 'Quick checkout without phone'
                : t('orderTracking') || 'Allows order tracking via phone'}
            </p>
          </div>

          {/* First Name */}
          <div className="mb-4">
            <label
              htmlFor="create-customer-firstName"
              className={`block text-sm font-medium text-gray-700 mb-1 ${isRTL ? 'text-right' : 'text-left'}`}
            >
              {t('firstName') || 'First Name'} <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              id="create-customer-firstName"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              dir={isRTL ? 'rtl' : 'ltr'}
              disabled={loading}
              className={`block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm disabled:bg-gray-100 disabled:cursor-not-allowed ${isRTL ? 'text-right' : 'text-left'}`}
              placeholder={t('firstName') || 'First Name'}
              required
            />
          </div>

          {/* Last Name */}
          <div className="mb-4">
            <label
              htmlFor="create-customer-lastName"
              className={`block text-sm font-medium text-gray-700 mb-1 ${isRTL ? 'text-right' : 'text-left'}`}
            >
              {t('lastName') || 'Last Name'}
            </label>
            <input
              type="text"
              id="create-customer-lastName"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              dir={isRTL ? 'rtl' : 'ltr'}
              disabled={loading}
              className={`block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm disabled:bg-gray-100 disabled:cursor-not-allowed ${isRTL ? 'text-right' : 'text-left'}`}
              placeholder={t('lastName') || 'Last Name'}
            />
          </div>

          {/* Phone (for stub customers) */}
          {customerType !== 'guest' && (
            <div className="mb-4">
              <label
                htmlFor="create-customer-phone"
                className={`block text-sm font-medium text-gray-700 mb-1 ${isRTL ? 'text-right' : 'text-left'}`}
              >
                {t('phoneNumber') || 'Phone Number'} <span className="text-red-500">*</span>
              </label>
              <div className={`flex ${isRTL ? 'flex-row-reverse' : ''}`}>
                <select
                  value={countryCode}
                  onChange={(e) => setCountryCode(e.target.value)}
                  disabled={loading}
                  className={`inline-flex items-center px-3 py-2 border border-gray-300 bg-gray-50 text-gray-700 text-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 disabled:opacity-50 ${isRTL ? 'rounded-r-md border-r border-l-0' : 'rounded-l-md border-l border-r-0'}`}
                >
                  {COUNTRY_CODES.map((c) => (
                    <option key={c.code} value={c.code}>
                      {c.flag} {c.code}
                    </option>
                  ))}
                </select>
                <input
                  type="tel"
                  id="create-customer-phone"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  dir="ltr"
                  disabled={loading}
                  className={`flex-1 block w-full px-3 py-2 border border-gray-300 ${isRTL ? 'rounded-l-md' : 'rounded-r-md'} shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm disabled:bg-gray-100 disabled:cursor-not-allowed`}
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
                htmlFor="create-customer-email"
                className={`block text-sm font-medium text-gray-700 mb-1 ${isRTL ? 'text-right' : 'text-left'}`}
              >
                {t('emailOptional') || 'Email (Optional)'}
              </label>
              <input
                type="email"
                id="create-customer-email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                dir="ltr"
                disabled={loading}
                className={`block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm disabled:bg-gray-100 disabled:cursor-not-allowed ${isRTL ? 'text-right' : 'text-left'}`}
                placeholder="customer@example.com"
              />
            </div>
          )}

          {/* Actions */}
          <div className={`mt-6 flex items-center ${isRTL ? 'flex-row-reverse justify-start space-x-reverse space-x-3' : 'justify-end space-x-3'}`}>
            <button
              type="button"
              onClick={handleClose}
              disabled={loading}
              className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {tCommon('cancel')}
            </button>
            <button
              type="submit"
              disabled={loading}
              className={`inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed ${isRTL ? 'flex-row-reverse' : ''}`}
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
                  {t('creating') || 'Creating...'}
                </>
              ) : (
                t('addCustomer') || 'Add Customer'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
