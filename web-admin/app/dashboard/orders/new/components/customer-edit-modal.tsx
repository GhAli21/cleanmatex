/**
 * Customer Edit Modal for New Order Flow
 * Allows editing customer profile directly from the order creation process
 * PRD-010: New Order UI
 */

'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { useRTL } from '@/lib/hooks/useRTL';
import { getCustomerById, updateCustomer } from '@/lib/api/customers';
import type { Customer, CustomerWithTenantData } from '@/lib/types/customer';

interface CustomerEditModalProps {
  open: boolean;
  customerId: string | null; // null when no customer selected
  onClose: () => void;
  onSuccess: (updatedCustomer: Customer) => void;
}

export function CustomerEditModal({
  open,
  customerId,
  onClose,
  onSuccess,
}: CustomerEditModalProps) {
  const t = useTranslations('customers');
  const tCommon = useTranslations('common');
  const isRTL = useRTL();
  
  // Form state
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [name, setName] = useState('');
  const [name2, setName2] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [address, setAddress] = useState('');
  const [area, setArea] = useState('');
  const [building, setBuilding] = useState('');
  const [floor, setFloor] = useState('');
  
  // UI state
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch customer data when modal opens
  useEffect(() => {
    const loadCustomerData = async () => {
      if (!open || !customerId) {
        return;
      }

      setFetching(true);
      setError(null);

      try {
        const customer: CustomerWithTenantData = await getCustomerById(customerId);
        
        // Populate form fields
        setFirstName(customer.firstName || '');
        setLastName(customer.lastName || '');
        setName(customer.name || '');
        setName2(customer.name2 || '');
        setDisplayName(customer.displayName || '');
        // Extract phone number without country code if present
        let phoneNumber = customer.phone || '';
        if (phoneNumber.startsWith('+968')) {
          phoneNumber = phoneNumber.substring(4);
        }
        setPhone(phoneNumber);
        setEmail(customer.email || '');
        setAddress(customer.address || '');
        setArea(customer.area || '');
        setBuilding(customer.building || '');
        setFloor(customer.floor || '');
      } catch (err) {
        const errorMessage = err instanceof Error 
          ? err.message 
          : (t('failedToLoadCustomer') || 'Failed to load customer data');
        setError(errorMessage);
      } finally {
        setFetching(false);
      }
    };

    loadCustomerData();
  }, [open, customerId, t]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validation
    if (!firstName.trim()) {
      setError(t('firstNameRequired') || 'First name is required');
      return;
    }

    if (!customerId) {
      setError(t('customerIdRequired') || 'Customer ID is required');
      return;
    }

    setLoading(true);

    try {
      const updatedCustomer = await updateCustomer(customerId, {
        firstName: firstName.trim(),
        lastName: lastName.trim() || undefined,
        name: name.trim() || undefined,
        name2: name2.trim() || undefined,
        displayName: displayName.trim() || undefined,
        email: email.trim() || undefined,
        address: address.trim() || undefined,
        area: area.trim() || undefined,
        building: building.trim() || undefined,
        floor: floor.trim() || undefined,
      });

      // Reset loading state before calling onSuccess
      setLoading(false);

      // Call success callback with updated customer
      onSuccess(updatedCustomer);
    } catch (err) {
      const errorMessage = err instanceof Error 
        ? err.message 
        : (t('failedToUpdateCustomer') || 'Failed to update customer');
      setError(errorMessage);
      setLoading(false);
    }
  };

  const handleClose = () => {
    if (loading || fetching) return; // Prevent closing while loading
    
    // Reset form on close
    setFirstName('');
    setLastName('');
    setName('');
    setName2('');
    setDisplayName('');
    setPhone('');
    setEmail('');
    setAddress('');
    setArea('');
    setBuilding('');
    setFloor('');
    setError(null);
    onClose();
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60] p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200">
          <div className={`flex items-center ${isRTL ? 'flex-row-reverse justify-between' : 'justify-between'}`}>
            <h3 className="text-lg font-medium text-gray-900">
              {t('editCustomer') || 'Edit Customer'}
            </h3>
            <button
              onClick={handleClose}
              disabled={loading || fetching}
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
            {t('editCustomerProfile') || 'Update customer profile information'}
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="px-6 py-4 overflow-y-auto flex-1">
          {/* Loading State */}
          {fetching && (
            <div className={`mb-4 flex items-center justify-center py-8 ${isRTL ? 'flex-row-reverse' : ''}`}>
              <svg
                className={`animate-spin h-6 w-6 text-blue-600 ${isRTL ? 'ml-2' : 'mr-2'}`}
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
              <span className="text-gray-600">{tCommon('loading')}</span>
            </div>
          )}

          {/* Error Message */}
          {error && !fetching && (
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

          {!fetching && (
            <>
              {/* Basic Information Section */}
              <div className="mb-6">
                <h4 className={`text-sm font-semibold text-gray-900 mb-4 ${isRTL ? 'text-right' : 'text-left'}`}>
                  {t('basicInformation') || 'Basic Information'}
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* First Name */}
                  <div>
                    <label
                      htmlFor="edit-customer-firstName"
                      className={`block text-sm font-medium text-gray-700 mb-1 ${isRTL ? 'text-right' : 'text-left'}`}
                    >
                      {t('firstName') || 'First Name'} <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      id="edit-customer-firstName"
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
                  <div>
                    <label
                      htmlFor="edit-customer-lastName"
                      className={`block text-sm font-medium text-gray-700 mb-1 ${isRTL ? 'text-right' : 'text-left'}`}
                    >
                      {t('lastName') || 'Last Name'}
                    </label>
                    <input
                      type="text"
                      id="edit-customer-lastName"
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                      dir={isRTL ? 'rtl' : 'ltr'}
                      disabled={loading}
                      className={`block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm disabled:bg-gray-100 disabled:cursor-not-allowed ${isRTL ? 'text-right' : 'text-left'}`}
                      placeholder={t('lastName') || 'Last Name'}
                    />
                  </div>

                  {/* Name */}
                  <div>
                    <label
                      htmlFor="edit-customer-name"
                      className={`block text-sm font-medium text-gray-700 mb-1 ${isRTL ? 'text-right' : 'text-left'}`}
                    >
                      {t('name') || 'Name'}
                    </label>
                    <input
                      type="text"
                      id="edit-customer-name"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      dir={isRTL ? 'rtl' : 'ltr'}
                      disabled={loading}
                      className={`block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm disabled:bg-gray-100 disabled:cursor-not-allowed ${isRTL ? 'text-right' : 'text-left'}`}
                      placeholder={t('name') || 'Name'}
                    />
                  </div>

                  {/* Name2 (Arabic) */}
                  <div>
                    <label
                      htmlFor="edit-customer-name2"
                      className={`block text-sm font-medium text-gray-700 mb-1 ${isRTL ? 'text-right' : 'text-left'}`}
                    >
                      {t('name2') || 'Name (Arabic)'}
                    </label>
                    <input
                      type="text"
                      id="edit-customer-name2"
                      value={name2}
                      onChange={(e) => setName2(e.target.value)}
                      dir="rtl"
                      disabled={loading}
                      className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm disabled:bg-gray-100 disabled:cursor-not-allowed text-right"
                      placeholder={t('name2') || 'Name (Arabic)'}
                    />
                  </div>

                  {/* Display Name */}
                  <div className="md:col-span-2">
                    <label
                      htmlFor="edit-customer-displayName"
                      className={`block text-sm font-medium text-gray-700 mb-1 ${isRTL ? 'text-right' : 'text-left'}`}
                    >
                      {t('displayName') || 'Display Name'}
                    </label>
                    <input
                      type="text"
                      id="edit-customer-displayName"
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                      dir={isRTL ? 'rtl' : 'ltr'}
                      disabled={loading}
                      className={`block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm disabled:bg-gray-100 disabled:cursor-not-allowed ${isRTL ? 'text-right' : 'text-left'}`}
                      placeholder={t('displayName') || 'Display Name'}
                    />
                  </div>
                </div>
              </div>

              {/* Contact Information Section */}
              <div className="mb-6">
                <h4 className={`text-sm font-semibold text-gray-900 mb-4 ${isRTL ? 'text-right' : 'text-left'}`}>
                  {t('contactInformation') || 'Contact Information'}
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Phone */}
                  <div>
                    <label
                      htmlFor="edit-customer-phone"
                      className={`block text-sm font-medium text-gray-700 mb-1 ${isRTL ? 'text-right' : 'text-left'}`}
                    >
                      {t('phoneNumber') || 'Phone Number'}
                    </label>
                    <div className={`flex ${isRTL ? 'flex-row-reverse' : ''}`}>
                      <span className={`inline-flex items-center px-3 ${isRTL ? 'rounded-r-md border-r border-l-0' : 'rounded-l-md border-l border-r-0'} border border-gray-300 bg-gray-50 text-gray-500 text-sm`}>
                        +968
                      </span>
                      <input
                        type="tel"
                        id="edit-customer-phone"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        dir="ltr"
                        disabled={loading}
                        className={`flex-1 block w-full px-3 py-2 border border-gray-300 ${isRTL ? 'rounded-l-md' : 'rounded-r-md'} shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm disabled:bg-gray-100 disabled:cursor-not-allowed`}
                        placeholder="90123456"
                      />
                    </div>
                  </div>

                  {/* Email */}
                  <div>
                    <label
                      htmlFor="edit-customer-email"
                      className={`block text-sm font-medium text-gray-700 mb-1 ${isRTL ? 'text-right' : 'text-left'}`}
                    >
                      {t('email') || 'Email'}
                    </label>
                    <input
                      type="email"
                      id="edit-customer-email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      dir="ltr"
                      disabled={loading}
                      className={`block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm disabled:bg-gray-100 disabled:cursor-not-allowed ${isRTL ? 'text-right' : 'text-left'}`}
                      placeholder="customer@example.com"
                    />
                  </div>
                </div>
              </div>

              {/* Address Information Section */}
              <div className="mb-6">
                <h4 className={`text-sm font-semibold text-gray-900 mb-4 ${isRTL ? 'text-right' : 'text-left'}`}>
                  {t('addressInformation') || 'Address Information'}
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Address */}
                  <div className="md:col-span-2">
                    <label
                      htmlFor="edit-customer-address"
                      className={`block text-sm font-medium text-gray-700 mb-1 ${isRTL ? 'text-right' : 'text-left'}`}
                    >
                      {t('address') || 'Address'}
                    </label>
                    <input
                      type="text"
                      id="edit-customer-address"
                      value={address}
                      onChange={(e) => setAddress(e.target.value)}
                      dir={isRTL ? 'rtl' : 'ltr'}
                      disabled={loading}
                      className={`block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm disabled:bg-gray-100 disabled:cursor-not-allowed ${isRTL ? 'text-right' : 'text-left'}`}
                      placeholder={t('address') || 'Address'}
                    />
                  </div>

                  {/* Area */}
                  <div>
                    <label
                      htmlFor="edit-customer-area"
                      className={`block text-sm font-medium text-gray-700 mb-1 ${isRTL ? 'text-right' : 'text-left'}`}
                    >
                      {t('area') || 'Area'}
                    </label>
                    <input
                      type="text"
                      id="edit-customer-area"
                      value={area}
                      onChange={(e) => setArea(e.target.value)}
                      dir={isRTL ? 'rtl' : 'ltr'}
                      disabled={loading}
                      className={`block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm disabled:bg-gray-100 disabled:cursor-not-allowed ${isRTL ? 'text-right' : 'text-left'}`}
                      placeholder={t('area') || 'Area'}
                    />
                  </div>

                  {/* Building */}
                  <div>
                    <label
                      htmlFor="edit-customer-building"
                      className={`block text-sm font-medium text-gray-700 mb-1 ${isRTL ? 'text-right' : 'text-left'}`}
                    >
                      {t('building') || 'Building'}
                    </label>
                    <input
                      type="text"
                      id="edit-customer-building"
                      value={building}
                      onChange={(e) => setBuilding(e.target.value)}
                      dir={isRTL ? 'rtl' : 'ltr'}
                      disabled={loading}
                      className={`block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm disabled:bg-gray-100 disabled:cursor-not-allowed ${isRTL ? 'text-right' : 'text-left'}`}
                      placeholder={t('building') || 'Building'}
                    />
                  </div>

                  {/* Floor */}
                  <div>
                    <label
                      htmlFor="edit-customer-floor"
                      className={`block text-sm font-medium text-gray-700 mb-1 ${isRTL ? 'text-right' : 'text-left'}`}
                    >
                      {t('floor') || 'Floor'}
                    </label>
                    <input
                      type="text"
                      id="edit-customer-floor"
                      value={floor}
                      onChange={(e) => setFloor(e.target.value)}
                      dir={isRTL ? 'rtl' : 'ltr'}
                      disabled={loading}
                      className={`block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm disabled:bg-gray-100 disabled:cursor-not-allowed ${isRTL ? 'text-right' : 'text-left'}`}
                      placeholder={t('floor') || 'Floor'}
                    />
                  </div>
                </div>
              </div>

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
                      {t('updating') || 'Updating...'}
                    </>
                  ) : (
                    t('saveChanges') || 'Save Changes'
                  )}
                </button>
              </div>
            </>
          )}
        </form>
      </div>
    </div>
  );
}
