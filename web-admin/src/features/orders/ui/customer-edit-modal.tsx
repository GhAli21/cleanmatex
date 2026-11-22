/**
 * Customer Edit Modal for New Order Flow
 * Allows editing customer profile directly from the order creation process
 * PRD-010: New Order UI
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { useRTL } from '@/lib/hooks/useRTL';
import { getCustomerById, updateCustomer } from '@/lib/api/customers';
import { fetchCustomerCategories } from '@/lib/api/customer-categories';
import type { Customer, CustomerWithTenantData } from '@/lib/types/customer';
import {
  CmxDialog,
  CmxDialogContent,
  CmxDialogDescription,
  CmxDialogFooter,
  CmxDialogHeader,
  CmxDialogTitle,
} from '@ui/overlays';
import { CmxButton, CmxInput, CmxSelect, Label } from '@ui/primitives';
import { CmxPhoneInput } from '@ui/forms';

interface CustomerEditModalProps {
  open: boolean;
  customerId: string | null; // null when no customer selected
  onClose: () => void;
  onSuccess: (updatedCustomer: Customer) => void;
}

/**
 *
 * @param root0
 * @param root0.open
 * @param root0.customerId
 * @param root0.onClose
 * @param root0.onSuccess
 */
export function CustomerEditModal({
  open,
  customerId,
  onClose,
  onSuccess,
}: CustomerEditModalProps) {
  const t = useTranslations('customers');
  const tB2b = useTranslations('b2b');
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
  const [customerCategoryId, setCustomerCategoryId] = useState('');
  const [b2bCategories, setB2bCategories] = useState<{ id: string; name: string }[]>([]);
  const [customerType, setCustomerType] = useState<string>('');

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
        setPhone(customer.phone || '');
        setEmail(customer.email || '');
        setAddress(customer.address || '');
        setArea(customer.area || '');
        setBuilding(customer.building || '');
        setFloor(customer.floor || '');
        setCustomerType(customer.type || '');
        setCustomerCategoryId(customer.customerCategoryId || '');
        if (customer.type === 'b2b') {
          fetchCustomerCategories({ is_b2b: true, active_only: true })
            .then((data) => setB2bCategories(data.map((c) => ({ id: c.id, name: c.name }))))
            .catch(() => { /* keep empty */ });
        }
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
  }, [open, customerId]); // eslint-disable-line react-hooks/exhaustive-deps

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
      const updates: Parameters<typeof updateCustomer>[1] = {
        firstName: firstName.trim(),
        lastName: lastName.trim() || undefined,
        name: name.trim() || undefined,
        name2: name2.trim() || undefined,
        displayName: displayName.trim() || undefined,
        phone: phone.trim() || undefined,
        email: email.trim() || undefined,
        address: address.trim() || undefined,
        area: area.trim() || undefined,
        building: building.trim() || undefined,
        floor: floor.trim() || undefined,
      };
      if (customerType === 'b2b') {
        updates.customerCategoryId = customerCategoryId.trim() || '';
      }
      const updatedCustomer = await updateCustomer(customerId, updates);

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

  const handleClose = useCallback(() => {
    if (loading) return; // Prevent closing while submitting changes

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
    setCustomerCategoryId('');
    setCustomerType('');
    setError(null);
    onClose();
  }, [loading, onClose]);

  const handleOpenChange = useCallback(
    (next: boolean) => {
      if (!next) handleClose();
    },
    [handleClose]
  );

  return (
    <CmxDialog
      open={open}
      onOpenChange={handleOpenChange}
      stackAboveModals
    >
      <CmxDialogContent className="max-w-2xl w-full" scrollBody>
        <CmxDialogHeader>
          <CmxDialogTitle>
            {t('editCustomer') || 'Edit Customer'}
          </CmxDialogTitle>
          <CmxDialogDescription className="text-start">
            {t('editCustomerProfile') || 'Update customer profile information'}
          </CmxDialogDescription>
        </CmxDialogHeader>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Loading State */}
          {fetching && (
            <div className="mb-4 flex items-center justify-center py-8">
              <svg
                className="animate-spin h-6 w-6 text-primary-text me-2"
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
              <span className="text-muted-foreground">{tCommon('loading')}</span>
            </div>
          )}

          {/* Error Message */}
          {error && !fetching && (
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

          {!fetching && (
            <>
              {/* Basic Information Section */}
              <div className="mb-6">
                <h4 className="text-sm font-semibold text-foreground mb-4 text-start">
                  {t('basicInformation') || 'Basic Information'}
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* First Name */}
                  <div>
                    <Label
                      htmlFor="edit-customer-firstName"
                      className="block mb-1 text-start"
                    >
                      {t('firstName') || 'First Name'} <span className="text-danger-text">*</span>
                    </Label>
                    <CmxInput
                      type="text"
                      id="edit-customer-firstName"
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      dir={isRTL ? 'rtl' : 'ltr'}
                      disabled={loading}
                      className="text-start"
                      placeholder={t('firstName') || 'First Name'}
                      required
                    />
                  </div>

                  {/* Last Name */}
                  <div>
                    <Label
                      htmlFor="edit-customer-lastName"
                      className="block mb-1 text-start"
                    >
                      {t('lastName') || 'Last Name'}
                    </Label>
                    <CmxInput
                      type="text"
                      id="edit-customer-lastName"
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                      dir={isRTL ? 'rtl' : 'ltr'}
                      disabled={loading}
                      className="text-start"
                      placeholder={t('lastName') || 'Last Name'}
                    />
                  </div>

                  {/* Name */}
                  <div>
                    <Label
                      htmlFor="edit-customer-name"
                      className="block mb-1 text-start"
                    >
                      {t('name') || 'Name'}
                    </Label>
                    <CmxInput
                      type="text"
                      id="edit-customer-name"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      dir={isRTL ? 'rtl' : 'ltr'}
                      disabled={loading}
                      className="text-start"
                      placeholder={t('name') || 'Name'}
                    />
                  </div>

                  {/* Name2 (Arabic) */}
                  <div>
                    <Label
                      htmlFor="edit-customer-name2"
                      className="block mb-1 text-start"
                    >
                      {t('name2') || 'Name (Arabic)'}
                    </Label>
                    <CmxInput
                      type="text"
                      id="edit-customer-name2"
                      value={name2}
                      onChange={(e) => setName2(e.target.value)}
                      dir="rtl"
                      disabled={loading}
                      className="text-end"
                      placeholder={t('name2') || 'Name (Arabic)'}
                    />
                  </div>

                  {/* Display Name */}
                  <div className="md:col-span-2">
                    <Label
                      htmlFor="edit-customer-displayName"
                      className="block mb-1 text-start"
                    >
                      {t('displayName') || 'Display Name'}
                    </Label>
                    <CmxInput
                      type="text"
                      id="edit-customer-displayName"
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                      dir={isRTL ? 'rtl' : 'ltr'}
                      disabled={loading}
                      className="text-start"
                      placeholder={t('displayName') || 'Display Name'}
                    />
                  </div>
                </div>
              </div>

              {/* Contact Information Section */}
              <div className="mb-6">
                <h4 className="text-sm font-semibold text-foreground mb-4 text-start">
                  {t('contactInformation') || 'Contact Information'}
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Phone */}
                  <div>
                    <Label
                      htmlFor="edit-customer-phone"
                      className="block mb-1 text-start"
                    >
                      {t('phoneNumber') || 'Phone Number'}
                    </Label>
                    <CmxPhoneInput
                      id="edit-customer-phone"
                      value={phone}
                      onChange={(e164) => setPhone(e164)}
                      disabled={loading}
                    />
                  </div>

                  {/* Email */}
                  <div>
                    <Label
                      htmlFor="edit-customer-email"
                      className="block mb-1 text-start"
                    >
                      {t('email') || 'Email'}
                    </Label>
                    <CmxInput
                      type="email"
                      id="edit-customer-email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      dir="ltr"
                      disabled={loading}
                      className="text-start"
                      placeholder="customer@example.com"
                    />
                  </div>
                </div>
              </div>

              {/* B2B Category Section */}
              {customerType === 'b2b' && (
                <div className="mb-6">
                  <h4 className="text-sm font-semibold text-foreground mb-4 text-start">
                    {tB2b('companyInfo') || 'Company'}
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label
                        htmlFor="edit-customer-category"
                        className="block mb-1 text-start"
                      >
                        {t('category') || 'Category'}
                      </Label>
                      <CmxSelect
                        id="edit-customer-category"
                        value={customerCategoryId}
                        onChange={(e) => setCustomerCategoryId(e.target.value)}
                        disabled={loading}
                        className="text-start"
                        placeholder={tCommon('select') || 'Select...'}
                        options={b2bCategories.map((c) => ({ value: c.id, label: c.name }))}
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Address Information Section */}
              <div className="mb-6">
                <h4 className="text-sm font-semibold text-foreground mb-4 text-start">
                  {t('addressInformation') || 'Address Information'}
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Address */}
                  <div className="md:col-span-2">
                    <Label
                      htmlFor="edit-customer-address"
                      className="block mb-1 text-start"
                    >
                      {t('address') || 'Address'}
                    </Label>
                    <CmxInput
                      type="text"
                      id="edit-customer-address"
                      value={address}
                      onChange={(e) => setAddress(e.target.value)}
                      dir={isRTL ? 'rtl' : 'ltr'}
                      disabled={loading}
                      className="text-start"
                      placeholder={t('address') || 'Address'}
                    />
                  </div>

                  {/* Area */}
                  <div>
                    <Label
                      htmlFor="edit-customer-area"
                      className="block mb-1 text-start"
                    >
                      {t('area') || 'Area'}
                    </Label>
                    <CmxInput
                      type="text"
                      id="edit-customer-area"
                      value={area}
                      onChange={(e) => setArea(e.target.value)}
                      dir={isRTL ? 'rtl' : 'ltr'}
                      disabled={loading}
                      className="text-start"
                      placeholder={t('area') || 'Area'}
                    />
                  </div>

                  {/* Building */}
                  <div>
                    <Label
                      htmlFor="edit-customer-building"
                      className="block mb-1 text-start"
                    >
                      {t('building') || 'Building'}
                    </Label>
                    <CmxInput
                      type="text"
                      id="edit-customer-building"
                      value={building}
                      onChange={(e) => setBuilding(e.target.value)}
                      dir={isRTL ? 'rtl' : 'ltr'}
                      disabled={loading}
                      className="text-start"
                      placeholder={t('building') || 'Building'}
                    />
                  </div>

                  {/* Floor */}
                  <div>
                    <Label
                      htmlFor="edit-customer-floor"
                      className="block mb-1 text-start"
                    >
                      {t('floor') || 'Floor'}
                    </Label>
                    <CmxInput
                      type="text"
                      id="edit-customer-floor"
                      value={floor}
                      onChange={(e) => setFloor(e.target.value)}
                      dir={isRTL ? 'rtl' : 'ltr'}
                      disabled={loading}
                      className="text-start"
                      placeholder={t('floor') || 'Floor'}
                    />
                  </div>
                </div>
              </div>

              <CmxDialogFooter className="mt-6 gap-3">
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
                  {loading ? (t('updating') || 'Updating...') : (t('saveChanges') || 'Save Changes')}
                </CmxButton>
              </CmxDialogFooter>
            </>
          )}
        </form>
      </CmxDialogContent>
    </CmxDialog>
  );
}
