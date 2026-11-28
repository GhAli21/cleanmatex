/**
 * PRD-003: Unified Lookup-First Customer Creation & Branch-Connect Modal
 * Shared by Customers Dashboard and POS New Order.
 *
 * For retail customers (stub):
 *   1. Search first by normalized mobile number or email (org_customers_mst -> sys_customers_mst).
 *   2. Handle ALREADY_IN_TENANT, INACTIVE_IN_TENANT, GLOBAL_MATCH_FOUND (connect),
 *      IDENTITY_CONFLICT, or NOT_FOUND (create new in sys + org atomically).
 * For guest / B2B customers:
 *   Creates a tenant-local org_customers_mst record directly.
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useRTL } from '@/lib/hooks/useRTL';
import { CmxButton, CmxInput, CmxSelect, Label } from '@ui/primitives';
import { CmxPhoneInput } from '@ui/forms';
import {
  CmxDialog,
  CmxDialogContent,
  CmxDialogDescription,
  CmxDialogFooter,
  CmxDialogHeader,
  CmxDialogTitle,
} from '@ui/overlays';
import { useMessage } from '@ui/feedback';
import {
  lookupCustomerIdentity,
  createOrConnectCustomer,
  reactivateCustomer,
} from '@/lib/api/customers';
import {
  fetchCustomerCategories,
  type CustomerCategoryItem,
} from '@/lib/api/customer-categories';
import { useFeature } from '@/src/features/auth/ui/RequireFeature';
import { FEATURE_FLAG_KEYS } from '@/lib/constants/feature-flags';
import type {
  Customer,
  CustomerType,
  CustomerLookupResponse,
} from '@/lib/types/customer';
import { Search, Link2, CheckCircle2, AlertTriangle, RefreshCw, UserPlus } from 'lucide-react';

export interface CustomerCreateModalProps {
  open?: boolean;
  onClose: () => void;
  onSuccess: (customer: Customer) => void | Promise<void>;
  /** Optional handler when selecting an already-existing tenant customer (e.g. POS picker) */
  onSelectExisting?: (customer: Customer) => void;
  /** When true, hide B2B type option (e.g. /dashboard/customers - guest/stub only) */
  hideB2B?: boolean;
  tenantId?: string;
}

export function CustomerCreateModal({
  open = true,
  onClose,
  onSuccess,
  onSelectExisting,
  hideB2B = false,
}: CustomerCreateModalProps) {
  const router = useRouter();
  const t = useTranslations('customers');
  const tB2b = useTranslations('b2b');
  const tCommon = useTranslations('common');
  const isRTL = useRTL();
  const { showSuccess, showErrorFrom } = useMessage();
  const hasB2B = useFeature(FEATURE_FLAG_KEYS.B2B_CONTRACTS);

  const [customerType, setCustomerType] = useState<CustomerType>('stub');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [companyName2, setCompanyName2] = useState('');
  const [taxId, setTaxId] = useState('');
  const [creditLimit, setCreditLimit] = useState('');
  const [paymentTermsDays, setPaymentTermsDays] = useState('');
  const [categoryId, setCategoryId] = useState<string>('');
  const [b2bCategories, setB2bCategories] = useState<CustomerCategoryItem[]>([]);
  const [individualCategories, setIndividualCategories] = useState<CustomerCategoryItem[]>([]);

  const [lookupResult, setLookupResult] = useState<CustomerLookupResponse | null>(null);
  const [lookupLoading, setLookupLoading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const resetForm = useCallback(() => {
    setCustomerType('stub');
    setFirstName('');
    setLastName('');
    setPhone('');
    setEmail('');
    setCompanyName('');
    setCompanyName2('');
    setTaxId('');
    setCreditLimit('');
    setPaymentTermsDays('');
    setCategoryId('');
    setLookupResult(null);
    setLookupLoading(false);
    setLoading(false);
    setError(null);
  }, []);

  useEffect(() => {
    if (!open) {
      resetForm();
    }
  }, [open, resetForm]);

  useEffect(() => {
    if (!hideB2B && hasB2B) {
      fetchCustomerCategories({ is_b2b: true, active_only: true, system_type: 'b2b' })
        .then(setB2bCategories)
        .catch(() => setB2bCategories([]));
    } else {
      setB2bCategories([]);
    }
  }, [hideB2B, hasB2B]);

  useEffect(() => {
    if (customerType === 'b2b') {
      setIndividualCategories([]);
      return;
    }
    const sysType = customerType === 'full' ? 'walk_in' : customerType;
    fetchCustomerCategories({ is_b2b: false, active_only: true, system_type: sysType })
      .then(setIndividualCategories)
      .catch(() => setIndividualCategories([]));
  }, [customerType]);

  const handleTypeChange = (nextType: CustomerType) => {
    setCustomerType(nextType);
    setCategoryId('');
    setLookupResult(null);
    setError(null);
  };

  const handleLookup = async () => {
    setError(null);
    const trimmedPhone = phone.trim();
    const trimmedEmail = email.trim();

    if (!trimmedPhone && !trimmedEmail) {
      setError(t('lookup.phoneOrEmailRequired'));
      return;
    }

    setLookupLoading(true);
    try {
      const result = await lookupCustomerIdentity({
        phone: trimmedPhone || undefined,
        email: trimmedEmail || undefined,
      });
      setLookupResult(result);
    } catch (err) {
      const msg = err instanceof Error ? err.message : t('failedToCreateCustomer');
      setError(msg);
      showErrorFrom(err, { fallback: msg });
    } finally {
      setLookupLoading(false);
    }
  };

  const handleConnectGlobal = async () => {
    if (!lookupResult?.globalCustomer) return;
    setError(null);
    setLoading(true);

    try {
      const globalMatch = lookupResult.globalCustomer;
      const result = await createOrConnectCustomer({
        type: 'stub',
        firstName: globalMatch.firstName || globalMatch.displayName || 'Customer',
        lastName: globalMatch.lastName || undefined,
        phone: lookupResult.normalizedPhone || phone.trim() || undefined,
        email: lookupResult.normalizedEmail || email.trim() || undefined,
        categoryId: categoryId || undefined,
        connectSysCustomerId: globalMatch.sysCustomerId,
      });

      showSuccess(t('lookup.connectedSuccess'));
      await onSuccess(result.customer);
    } catch (err) {
      const msg = err instanceof Error ? err.message : t('failedToCreateCustomer');
      setError(msg);
      showErrorFrom(err, { fallback: t('failedToCreateCustomer') });
    } finally {
      setLoading(false);
    }
  };

  const handleReactivateExisting = async () => {
    if (!lookupResult?.tenantCustomer) return;
    setError(null);
    setLoading(true);

    try {
      const reactivated = await reactivateCustomer(lookupResult.tenantCustomer.id);
      showSuccess(t('lookup.reactivatedSuccess'));
      if (onSelectExisting) {
        onSelectExisting(reactivated);
      } else {
        await onSuccess(reactivated);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : t('failedToUpdateCustomer');
      setError(msg);
      showErrorFrom(err, { fallback: t('failedToUpdateCustomer') });
    } finally {
      setLoading(false);
    }
  };

  const handleUseExistingTenantCustomer = async () => {
    if (!lookupResult?.tenantCustomer) return;
    const existing = lookupResult.tenantCustomer;
    const mapped: Customer = {
      id: existing.id,
      customerCode: existing.customerCode,
      sysCustomerId: existing.sysCustomerId,
      customerNumber: existing.customerCode ?? existing.id,
      firstName: existing.firstName,
      lastName: existing.lastName,
      displayName: existing.displayName,
      name: existing.displayName,
      name2: null,
      phone: existing.phone,
      phoneVerified: false,
      email: existing.email,
      emailVerified: false,
      type: existing.type,
      profileStatus: 1,
      avatarUrl: null,
      preferences: {},
      preferredLanguage: null,
      address: null,
      area: null,
      building: null,
      floor: null,
      firstTenantOrgId: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    if (onSelectExisting) {
      onSelectExisting(mapped);
      onClose();
      return;
    }

    onClose();
    router.push(`/dashboard/customers/${existing.id}`);
  };

  const handleCreateSubmit = async () => {
    setError(null);

    if (customerType === 'stub' && lookupResult?.status !== 'NOT_FOUND') {
      await handleLookup();
      return;
    }

    if (!firstName.trim()) {
      setError(t('firstNameRequired'));
      return;
    }

    if (customerType === 'stub' && !phone.trim() && !email.trim()) {
      setError(t('lookup.phoneOrEmailRequired'));
      return;
    }

    if (customerType === 'b2b') {
      if (!phone.trim()) {
        setError(t('phoneRequiredStubFull'));
        return;
      }
      if (!companyName.trim()) {
        setError(tB2b('companyName') ? `${tB2b('companyName')} is required` : 'Company name is required');
        return;
      }
      if (hasB2B && b2bCategories.length > 0 && !categoryId) {
        setError('Please select a B2B category');
        return;
      }
    }

    setLoading(true);
    try {
      if (customerType === 'stub') {
        const result = await createOrConnectCustomer({
          type: 'stub',
          firstName: firstName.trim(),
          lastName: lastName.trim() || undefined,
          phone: lookupResult?.normalizedPhone || phone.trim() || undefined,
          email: lookupResult?.normalizedEmail || email.trim() || undefined,
          categoryId: categoryId || undefined,
        });
        showSuccess(
          result.action === 'CONNECTED_EXISTING'
            ? t('lookup.connectedSuccess')
            : t('lookup.createdSuccess')
        );
        await onSuccess(result.customer);
      } else if (customerType === 'guest') {
        const result = await createOrConnectCustomer({
          type: 'guest',
          firstName: firstName.trim(),
          lastName: lastName.trim() || undefined,
          categoryId: categoryId || undefined,
        });
        showSuccess(t('lookup.createdSuccess'));
        await onSuccess(result.customer);
      } else if (customerType === 'b2b') {
        const result = await createOrConnectCustomer({
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
        });
        showSuccess(t('lookup.createdSuccess'));
        await onSuccess(result.customer);
      } else {
        setError(t('fullCustomerRequiresOTP'));
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : t('failedToCreateCustomer');
      setError(msg);
      showErrorFrom(err, { fallback: t('failedToCreateCustomer') });
    } finally {
      setLoading(false);
    }
  };

  const isStubLookupPhase = customerType === 'stub' && lookupResult?.status !== 'NOT_FOUND';
  const showNewCustomerDetails =
    customerType === 'guest' ||
    customerType === 'b2b' ||
    (customerType === 'stub' && lookupResult?.status === 'NOT_FOUND');

  return (
    <CmxDialog
      open={open}
      onOpenChange={(next) => {
        if (!next && !loading && !lookupLoading) onClose();
      }}
      stackAboveModals
    >
      <CmxDialogContent className="max-w-lg w-full p-0" scrollBody>
        <CmxDialogHeader>
          <CmxDialogTitle>{t('quickAddCustomer')}</CmxDialogTitle>
          <CmxDialogDescription>{t('createQuickProfile')}</CmxDialogDescription>
        </CmxDialogHeader>

        <div className="px-6 py-4 space-y-4">
          {error && (
            <div className="bg-danger-bg border-s-4 border-e-0 border-destructive p-3 rounded-md flex items-start gap-2.5">
              <AlertTriangle className="h-4 w-4 text-danger-text shrink-0 mt-0.5" aria-hidden />
              <p className="text-sm text-danger-text text-start">{error}</p>
            </div>
          )}

          {/* Customer Type Selection */}
          <div>
            <Label className="mb-2 block text-start">{t('customerType')}</Label>
            <div className={`grid gap-2.5 ${hasB2B && !hideB2B ? 'grid-cols-3' : 'grid-cols-2'}`}>
              <CmxButton
                type="button"
                variant={customerType === 'stub' ? 'primary' : 'secondary'}
                size="sm"
                onClick={() => handleTypeChange('stub')}
                disabled={loading || lookupLoading}
              >
                {t('stubRecommended')}
              </CmxButton>
              <CmxButton
                type="button"
                variant={customerType === 'guest' ? 'primary' : 'secondary'}
                size="sm"
                onClick={() => handleTypeChange('guest')}
                disabled={loading || lookupLoading}
              >
                {t('types.guest')}
              </CmxButton>
              {hasB2B && !hideB2B && (
                <CmxButton
                  type="button"
                  variant={customerType === 'b2b' ? 'primary' : 'secondary'}
                  size="sm"
                  onClick={() => handleTypeChange('b2b')}
                  disabled={loading || lookupLoading}
                >
                  {t('types.b2b')}
                </CmxButton>
              )}
            </div>
            <p className="mt-1.5 text-xs text-muted-foreground text-start">
              {customerType === 'guest'
                ? t('quickCheckout')
                : customerType === 'b2b'
                  ? tB2b('companyName')
                  : t('lookup.stepLookupHint')}
            </p>
          </div>

          {/* Phase 1: Contact Lookup (Phone or Email) for Retail Stub */}
          {customerType === 'stub' && (
            <div className="rounded-lg border border-border bg-muted/40 p-4 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-medium text-foreground">
                  {t('lookup.stepLookupTitle')}
                </span>
                {lookupResult && (
                  <CmxButton
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setLookupResult(null);
                      setError(null);
                    }}
                    disabled={loading || lookupLoading}
                  >
                    {t('lookup.changeContact')}
                  </CmxButton>
                )}
              </div>

              <div>
                <Label htmlFor="lookup-phone" className="mb-1 block text-start">
                  {t('phoneNumber')}
                </Label>
                <CmxPhoneInput
                  id="lookup-phone"
                  value={phone}
                  onChange={(e164) => {
                    setPhone(e164);
                    if (lookupResult) setLookupResult(null);
                  }}
                  disabled={loading || lookupLoading}
                />
              </div>

              <div>
                <Label htmlFor="lookup-email" className="mb-1 block text-start">
                  {t('emailOptional')}
                </Label>
                <CmxInput
                  type="email"
                  id="lookup-email"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    if (lookupResult) setLookupResult(null);
                  }}
                  dir="ltr"
                  placeholder="customer@example.com"
                  disabled={loading || lookupLoading}
                />
              </div>

              {isStubLookupPhase && (
                <CmxButton
                  type="button"
                  variant="primary"
                  size="sm"
                  onClick={handleLookup}
                  loading={lookupLoading}
                  disabled={loading || lookupLoading || (!phone.trim() && !email.trim())}
                  className="w-full"
                >
                  <Search className="h-4 w-4 me-2" aria-hidden />
                  {lookupLoading ? t('lookup.searching') : t('lookup.searchAction')}
                </CmxButton>
              )}
            </div>
          )}

          {/* Lookup Result Cards */}
          {customerType === 'stub' && lookupResult?.status === 'ALREADY_IN_TENANT' && lookupResult.tenantCustomer && (
            <div className="rounded-lg border border-info-border bg-info-bg p-4 space-y-3 text-start">
              <div className="flex items-start gap-2.5">
                <CheckCircle2 className="h-5 w-5 text-primary-text shrink-0 mt-0.5" aria-hidden />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-foreground">
                    {t('lookup.alreadyInTenantTitle')}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {t('lookup.alreadyInTenantDesc')}
                  </p>
                  <div className="mt-2 text-sm text-foreground space-y-0.5">
                    <div className="font-medium">
                      {lookupResult.tenantCustomer.displayName ||
                        `${lookupResult.tenantCustomer.firstName} ${lookupResult.tenantCustomer.lastName ?? ''}`.trim()}
                    </div>
                    {lookupResult.tenantCustomer.customerCode && (
                      <div className="text-xs text-muted-foreground">
                        {t('lookup.customerCode')}:{' '}
                        <bdi dir="ltr" className="font-mono font-medium text-foreground">
                          {lookupResult.tenantCustomer.customerCode}
                        </bdi>
                      </div>
                    )}
                    <div className="text-xs text-muted-foreground">
                      {lookupResult.tenantCustomer.phone && (
                        <bdi dir="ltr" className="tabular-nums">
                          {lookupResult.tenantCustomer.phone}
                        </bdi>
                      )}
                      {lookupResult.tenantCustomer.phone && lookupResult.tenantCustomer.email && (
                        <span className="mx-1.5">•</span>
                      )}
                      {lookupResult.tenantCustomer.email && (
                        <bdi dir="ltr">{lookupResult.tenantCustomer.email}</bdi>
                      )}
                    </div>
                  </div>
                </div>
              </div>
              <CmxButton
                type="button"
                variant="primary"
                size="sm"
                onClick={handleUseExistingTenantCustomer}
                className="w-full"
              >
                {onSelectExisting ? t('lookup.selectExisting') : t('lookup.openExisting')}
              </CmxButton>
            </div>
          )}

          {customerType === 'stub' && lookupResult?.status === 'INACTIVE_IN_TENANT' && lookupResult.tenantCustomer && (
            <div className="rounded-lg border border-warning-border bg-warning-bg p-4 space-y-3 text-start">
              <div className="flex items-start gap-2.5">
                <RefreshCw className="h-5 w-5 text-warning-text shrink-0 mt-0.5" aria-hidden />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-foreground">
                    {t('lookup.inactiveInTenantTitle')}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {t('lookup.inactiveInTenantDesc')}
                  </p>
                  <div className="mt-2 text-sm font-medium text-foreground">
                    {lookupResult.tenantCustomer.displayName || lookupResult.tenantCustomer.firstName}
                    {lookupResult.tenantCustomer.customerCode && (
                      <span className="ms-2 text-xs font-mono text-muted-foreground" dir="ltr">
                        ({lookupResult.tenantCustomer.customerCode})
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <CmxButton
                type="button"
                variant="primary"
                size="sm"
                onClick={handleReactivateExisting}
                loading={loading}
                disabled={loading}
                className="w-full"
              >
                {loading ? t('lookup.reactivating') : t('lookup.reactivateAction')}
              </CmxButton>
            </div>
          )}

          {customerType === 'stub' && lookupResult?.status === 'GLOBAL_MATCH_FOUND' && lookupResult.globalCustomer && (
            <div className="rounded-lg border border-info-border bg-info-bg p-4 space-y-3 text-start">
              <div className="flex items-start gap-2.5">
                <Link2 className="h-5 w-5 text-primary-text shrink-0 mt-0.5" aria-hidden />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-foreground">
                    {t('lookup.globalMatchTitle')}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {t('lookup.globalMatchDesc')}
                  </p>
                  <div className="mt-2 text-sm text-foreground space-y-0.5">
                    <div className="font-medium">
                      {lookupResult.globalCustomer.displayName ||
                        `${lookupResult.globalCustomer.firstName} ${lookupResult.globalCustomer.lastName ?? ''}`.trim()}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {t('lookup.customerCode')}:{' '}
                      <bdi dir="ltr" className="font-mono font-medium text-foreground">
                        {lookupResult.globalCustomer.customerCode}
                      </bdi>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {lookupResult.globalCustomer.maskedPhone && (
                        <bdi dir="ltr" className="tabular-nums">
                          {lookupResult.globalCustomer.maskedPhone}
                        </bdi>
                      )}
                      {lookupResult.globalCustomer.maskedPhone &&
                        lookupResult.globalCustomer.maskedEmail && (
                          <span className="mx-1.5">•</span>
                        )}
                      {lookupResult.globalCustomer.maskedEmail && (
                        <bdi dir="ltr">{lookupResult.globalCustomer.maskedEmail}</bdi>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {individualCategories.length > 0 && (
                <div>
                  <Label htmlFor="connectCategoryId" className="mb-1 block text-start">
                    {t('category')}
                  </Label>
                  <CmxSelect
                    id="connectCategoryId"
                    value={categoryId}
                    onChange={(e) => setCategoryId(e.target.value)}
                    options={[
                      { value: '', label: `${t('category')} (${tCommon('optional')})` },
                      ...individualCategories.map((c) => ({ value: c.id, label: c.name })),
                    ]}
                  />
                </div>
              )}

              <CmxButton
                type="button"
                variant="primary"
                size="sm"
                onClick={handleConnectGlobal}
                loading={loading}
                disabled={loading}
                className="w-full"
              >
                <Link2 className="h-4 w-4 me-2" aria-hidden />
                {loading ? t('lookup.connecting') : t('lookup.connectAction')}
              </CmxButton>
            </div>
          )}

          {customerType === 'stub' && lookupResult?.status === 'IDENTITY_CONFLICT' && (
            <div className="rounded-lg border border-destructive bg-danger-bg p-4 text-start flex items-start gap-2.5">
              <AlertTriangle className="h-5 w-5 text-danger-text shrink-0 mt-0.5" aria-hidden />
              <div>
                <p className="text-sm font-semibold text-danger-text">
                  {t('lookup.conflictTitle')}
                </p>
                <p className="text-xs text-danger-text mt-0.5">
                  {lookupResult.conflictMessage || t('lookup.conflictDesc')}
                </p>
              </div>
            </div>
          )}

          {customerType === 'stub' && lookupResult?.status === 'NOT_FOUND' && (
            <div className="rounded-md border border-border bg-muted/60 px-3 py-2 flex items-center gap-2 text-xs text-foreground">
              <UserPlus className="h-4 w-4 text-primary-text shrink-0" aria-hidden />
              <span>{t('lookup.notFoundBadge')}</span>
            </div>
          )}

          {/* Phase 2: New Customer Details (Stub NOT_FOUND, Guest, or B2B) */}
          {showNewCustomerDetails && (
            <div className="space-y-4">
              <div>
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
                  disabled={loading}
                  required
                />
              </div>

              <div>
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
                  disabled={loading}
                />
              </div>

              {customerType === 'b2b' && (
                <>
                  <div>
                    <Label htmlFor="b2b-phone" className="mb-1 block text-start">
                      {t('phoneNumber')} <span className="text-danger-text">*</span>
                    </Label>
                    <CmxPhoneInput
                      id="b2b-phone"
                      value={phone}
                      onChange={(e164) => setPhone(e164)}
                      disabled={loading}
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="b2b-email" className="mb-1 block text-start">
                      {t('emailOptional')}
                    </Label>
                    <CmxInput
                      type="email"
                      id="b2b-email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      dir="ltr"
                      placeholder="customer@example.com"
                      disabled={loading}
                    />
                  </div>
                </>
              )}

              {customerType === 'b2b' && hasB2B && b2bCategories.length > 0 && (
                <div>
                  <Label htmlFor="categoryId" className="mb-1 block text-start">
                    {t('category')} <span className="text-danger-text">*</span>
                  </Label>
                  <CmxSelect
                    id="categoryId"
                    value={categoryId}
                    onChange={(e) => setCategoryId(e.target.value)}
                    required
                    options={[
                      { value: '', label: t('category') },
                      ...b2bCategories.map((c) => ({ value: c.id, label: c.name })),
                    ]}
                  />
                </div>
              )}

              {(customerType === 'guest' || customerType === 'stub') && individualCategories.length > 0 && (
                <div>
                  <Label htmlFor="categoryIdIndividual" className="mb-1 block text-start">
                    {t('category')}
                  </Label>
                  <CmxSelect
                    id="categoryIdIndividual"
                    value={categoryId}
                    onChange={(e) => setCategoryId(e.target.value)}
                    options={[
                      { value: '', label: `${t('category')} (${tCommon('optional')})` },
                      ...individualCategories.map((c) => ({ value: c.id, label: c.name })),
                    ]}
                  />
                </div>
              )}

              {customerType === 'b2b' && (
                <>
                  <div>
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
                      disabled={loading}
                      required
                    />
                  </div>
                  <div>
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
                      disabled={loading}
                    />
                  </div>
                  <div>
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
                      disabled={loading}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
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
                        disabled={loading}
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
                        disabled={loading}
                      />
                    </div>
                  </div>
                </>
              )}
            </div>
          )}
        </div>

        <CmxDialogFooter className="px-6 py-4 border-t border-border">
          <CmxButton
            type="button"
            variant="secondary"
            onClick={onClose}
            disabled={loading || lookupLoading}
          >
            {tCommon('cancel')}
          </CmxButton>
          {showNewCustomerDetails && (
            <CmxButton
              type="button"
              variant="primary"
              onClick={handleCreateSubmit}
              loading={loading}
              disabled={loading || lookupLoading}
            >
              {loading ? t('creating') : t('addCustomer')}
            </CmxButton>
          )}
        </CmxDialogFooter>
      </CmxDialogContent>
    </CmxDialog>
  );
}

export default CustomerCreateModal;
