/**
 * Customer Picker Modal Component
 * Search and select customer with progressive search
 * PRD-010: New Order UI
 * Refactored for fast search, React Query caching, keyboard nav, best UX
 */

'use client';

import { useState, useCallback, useRef, useEffect, useDeferredValue } from 'react';
import { useTranslations } from 'next-intl';
import { useQuery } from '@tanstack/react-query';
import { useRTL } from '@/lib/hooks/useRTL';
import {
  useCustomerSearch,
  CUSTOMER_SEARCH_MIN_CHARS,
} from '@/lib/hooks/use-customer-search';
import { searchCustomersForPicker } from '@/lib/api/customers';
import { CmxInput } from '@ui/primitives/cmx-input';
import { CmxButton } from '@ui/primitives/cmx-button';
import { CustomerCreateModal } from './customer-create-modal';
import type { Customer as CustomerType } from '@/lib/types/customer';
import type { CustomerSearchItem } from '@/lib/api/customers';
import { UserCircle } from 'lucide-react';

interface Customer {
  id: string;
  name?: string;
  name2?: string;
  displayName?: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
  email?: string;
  source?: 'current_tenant' | 'sys_global' | 'other_tenant';
  belongsToCurrentTenant?: boolean;
  originalTenantId?: string;
  customerId?: string;
  orgCustomerId?: string;
  isDefaultCustomer?: boolean;
}

interface DefaultGuestCustomer {
  id: string;
  name?: string | null;
  name2?: string | null;
  displayName?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  phone?: string | null;
  email?: string | null;
}

function mapSearchItemToCustomer(c: CustomerSearchItem): Customer {
  return {
    id: c.id,
    name: c.displayName || `${c.firstName || ''} ${c.lastName || ''}`.trim() || undefined,
    name2: undefined,
    displayName: c.displayName ?? undefined,
    firstName: c.firstName,
    lastName: c.lastName ?? undefined,
    phone: c.phone ?? undefined,
    email: c.email ?? undefined,
    source: c.source,
    belongsToCurrentTenant: c.belongsToCurrentTenant,
    originalTenantId: c.originalTenantId,
    customerId: c.customerId,
    orgCustomerId: c.orgCustomerId,
  };
}

interface CustomerPickerModalProps {
  open: boolean;
  onClose: () => void;
  onSelectCustomer: (customer: Customer) => void;
  tenantId?: string;
}

export function CustomerPickerModal({ open, onClose, onSelectCustomer, tenantId }: CustomerPickerModalProps) {
  const t = useTranslations('newOrder.customerPicker');
  const tCommon = useTranslations('common');
  const isRTL = useRTL();
  const [search, setSearch] = useState('');
  const [searchPhone, setSearchPhone] = useState('');
  const [searchName, setSearchName] = useState('');
  const [searchEmail, setSearchEmail] = useState('');
  const [advancedSearchOpen, setAdvancedSearchOpen] = useState(false);
  const [searchAllOptions, setSearchAllOptions] = useState(false);
  const [linkingCustomer, setLinkingCustomer] = useState<Customer | null>(null);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [linkLoading, setLinkLoading] = useState(false);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [focusedIndex, setFocusedIndex] = useState(0);
  const resultsRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Fetch default guest customer when modal opens
  const { data: defaultGuest, isLoading: defaultGuestLoading } = useQuery({
    queryKey: ['tenant-settings', 'default-guest-customer', tenantId],
    queryFn: async (): Promise<DefaultGuestCustomer | null> => {
      const res = await fetch('/api/v1/tenant-settings/default-guest-customer');
      if (res.status === 404) return null;
      if (!res.ok) throw new Error('Failed to fetch default guest customer');
      const json = await res.json();
      return json.success && json.data ? json.data : null;
    },
    enabled: open && !!tenantId,
    staleTime: 60_000,
  });

  // Defer search term used for API/list so input stays responsive (fixes INP)
  const deferredSearch = useDeferredValue(search);
  const { customers: rawCustomers, isLoading, isFetching, error, isReady } = useCustomerSearch({
    search: deferredSearch,
    searchPhone,
    searchName,
    searchEmail,
    searchAllOptions,
    limit: 10,
    minChars: CUSTOMER_SEARCH_MIN_CHARS,
  });

  const customers = rawCustomers.map(mapSearchItemToCustomer);

  // Reset focused index when customers change
  useEffect(() => {
    setFocusedIndex(0);
  }, [customers.length]);

  // Focus input when modal opens
  useEffect(() => {
    if (open) {
      setSearch('');
      setSearchPhone('');
      setSearchName('');
      setSearchEmail('');
      setCreateError(null);
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [open]);

  const handleDefaultGuestSelect = useCallback(() => {
    if (!defaultGuest) return;
    const customer: Customer = {
      id: defaultGuest.id,
      name: defaultGuest.displayName ?? defaultGuest.name ?? undefined,
      name2: defaultGuest.name2 ?? undefined,
      displayName: defaultGuest.displayName ?? undefined,
      firstName: defaultGuest.firstName ?? undefined,
      lastName: defaultGuest.lastName ?? undefined,
      phone: defaultGuest.phone ?? undefined,
      email: defaultGuest.email ?? undefined,
      source: 'current_tenant',
      belongsToCurrentTenant: true,
      isDefaultCustomer: true,
    };
    onSelectCustomer(customer);
    onClose();
  }, [defaultGuest, onSelectCustomer, onClose]);

  const handleCustomerClick = useCallback(
    (customer: Customer) => {
      if (customer.source === 'current_tenant' || customer.belongsToCurrentTenant) {
        onSelectCustomer(customer);
        setSearch('');
        return;
      }
      setLinkingCustomer(customer);
      setShowConfirmDialog(true);
    },
    [onSelectCustomer]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (customers.length === 0) return;
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setFocusedIndex((i) => Math.min(i + 1, customers.length - 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setFocusedIndex((i) => Math.max(i - 1, 0));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        const customer = customers[focusedIndex];
        if (customer) handleCustomerClick(customer);
      } else if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    },
    [customers, focusedIndex, handleCustomerClick, onClose]
  );

  const handleLinkCustomer = async () => {
    if (!linkingCustomer) return;

    setLinkLoading(true);
    setCreateError(null);
    try {
      const isSysGlobal = linkingCustomer.source === 'sys_global';
      const isOtherTenant = linkingCustomer.source === 'other_tenant';

      const body: {
        customerId: string;
        sourceType: 'sys' | 'org_other_tenant';
        originalTenantId?: string;
      } = {
        customerId: isSysGlobal
          ? (linkingCustomer.customerId || linkingCustomer.id)
          : (linkingCustomer.orgCustomerId || linkingCustomer.id),
        sourceType: isSysGlobal ? 'sys' : 'org_other_tenant',
      };

      if (isOtherTenant) {
        if (!linkingCustomer.originalTenantId) {
          throw new Error('Missing tenant information for customer linking');
        }
        body.originalTenantId = linkingCustomer.originalTenantId;
      }

      if (!body.customerId) {
        throw new Error('Invalid customer ID');
      }

      const res = await fetch('/api/v1/customers/link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const json = (await res.json()) as {
        success: boolean;
        data?: { orgCustomerId: string; customerId: string };
        error?: string;
      };

      if (!res.ok || !json.success) {
        throw new Error(json.error || 'Failed to link customer');
      }

      if (!json.data) {
        throw new Error('Invalid response from server');
      }

      const linkedCustomer: Customer = {
        ...linkingCustomer,
        id: json.data.orgCustomerId,
        source: 'current_tenant',
        belongsToCurrentTenant: true,
      };

      onSelectCustomer(linkedCustomer);
      setShowConfirmDialog(false);
      setLinkingCustomer(null);
      setSearch('');
    } catch (err: unknown) {
      console.error('Failed to link customer:', err);
      setCreateError(err instanceof Error ? err.message : 'Failed to link customer');
    } finally {
      setLinkLoading(false);
    }
  };

  const handleClose = useCallback(() => {
    onClose();
    setSearch('');
    setShowConfirmDialog(false);
    setLinkingCustomer(null);
    setCreateError(null);
  }, [onClose]);

  const displayError = error?.message ?? createError;
  const hasFieldSearch =
    searchPhone.trim().length >= 3 ||
    searchName.trim().length >= CUSTOMER_SEARCH_MIN_CHARS ||
    searchEmail.trim().length >= 3;
  const canSearch = search.trim().length >= CUSTOMER_SEARCH_MIN_CHARS || hasFieldSearch;
  const showResults = canSearch && isReady && !displayError;

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="customer-picker-title"
      aria-describedby="customer-picker-desc"
    >
      <div
        className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[85vh] flex flex-col overflow-hidden"
        onKeyDown={handleKeyDown}
      >
        {/* Header */}
        <div className="px-6 pt-6 pb-4">
          <h2
            id="customer-picker-title"
            className={`text-2xl font-semibold text-gray-900 ${isRTL ? 'text-right' : 'text-left'}`}
          >
            {t('title')}
          </h2>
          <p
            id="customer-picker-desc"
            className={`text-gray-500 text-sm mt-1 ${isRTL ? 'text-right' : 'text-left'}`}
          >
            {t('description')}
          </p>
        </div>

        {/* Default Guest Customer - Quick Action Banner (only if exists) */}
        {!defaultGuestLoading && defaultGuest && (
          <div className="mx-6 mb-4">
            <div
              className={`flex items-center justify-between gap-3 p-4 bg-blue-50 border border-blue-200 rounded-lg ${isRTL ? 'flex-row-reverse' : ''}`}
            >
              <div className={`flex items-center gap-3 flex-1 min-w-0 ${isRTL ? 'flex-row-reverse' : ''}`}>
                <div className="shrink-0 w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
                  <UserCircle className="h-6 w-6 text-blue-600" aria-hidden />
                </div>
                <div className={`flex-1 min-w-0 ${isRTL ? 'text-right' : 'text-left'}`}>
                  <div className="text-sm font-medium text-gray-900 truncate">
                    {defaultGuest.displayName || defaultGuest.name || defaultGuest.name2 || defaultGuest.id}
                  </div>
                  <div className="text-xs text-gray-600 truncate">
                    {defaultGuest.phone || defaultGuest.email || t('defaultGuest')}
                  </div>
                </div>
              </div>
              <CmxButton
                type="button"
                variant="primary"
                size="sm"
                onClick={handleDefaultGuestSelect}
                className="shrink-0"
                aria-label={t('useDefaultGuest') || 'Use default guest'}
              >
                {t('quickSelect') || 'Quick Select'}
              </CmxButton>
            </div>
          </div>
        )}

        {/* Search Section */}
        <div className="px-6 pb-4 space-y-3">
          {/* Main Search Input */}
          <div>
            <label
              htmlFor="customer-search-input"
              className={`block text-sm font-medium text-gray-700 mb-2 ${isRTL ? 'text-right' : 'text-left'}`}
            >
              {t('searchLabel') || 'Search Customer'}
            </label>
            <div className="relative">
              <CmxInput
                id="customer-search-input"
                ref={inputRef}
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                dir={isRTL ? 'rtl' : 'ltr'}
                placeholder={t('searchPlaceholder')}
                className={`w-full text-base ${isRTL ? 'text-right' : 'text-left'}`}
                autoComplete="off"
                aria-label={t('searchPlaceholder')}
                aria-describedby="customer-search-hint"
                aria-controls="customer-results-list"
                aria-expanded={customers.length > 0}
              />
              {isFetching && (
                <div
                  className={`absolute top-1/2 -translate-y-1/2 ${isRTL ? 'left-3' : 'right-3'}`}
                  aria-hidden="true"
                >
                  <svg
                    className="animate-spin h-5 w-5 text-blue-500"
                    xmlns="http://www.w3.org/2000/svg"
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
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                    />
                  </svg>
                </div>
              )}
            </div>
            <p
              id="customer-search-hint"
              className={`text-xs text-gray-500 mt-1.5 ${isRTL ? 'text-right' : 'text-left'}`}
            >
              {t('searchHint')}
            </p>
          </div>

          {/* Advanced Search Toggle */}
          <div className={`flex items-center gap-2 ${isRTL ? 'flex-row-reverse justify-end' : 'justify-start'}`}>
            <button
              type="button"
              onClick={() => setAdvancedSearchOpen((o) => !o)}
              className={`inline-flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 rounded px-2 py-1 transition-colors ${isRTL ? 'flex-row-reverse' : ''}`}
              aria-expanded={advancedSearchOpen}
            >
              <svg
                className={`w-4 h-4 transition-transform ${advancedSearchOpen ? 'rotate-180' : ''}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
              <span>{t('advancedSearch') || 'Advanced search'}</span>
            </button>
          </div>

          {/* Advanced Search Fields */}
          {advancedSearchOpen && (
            <div className="pt-2 pb-1 space-y-3">
              <div className={`grid grid-cols-1 sm:grid-cols-3 gap-3 ${isRTL ? 'text-right' : 'text-left'}`}>
                <div>
                  <label htmlFor="search-phone" className="block text-xs font-medium text-gray-700 mb-1.5">
                    {tCommon('phone') || 'Phone'}
                  </label>
                  <CmxInput
                    id="search-phone"
                    type="tel"
                    value={searchPhone}
                    onChange={(e) => setSearchPhone(e.target.value)}
                    dir="ltr"
                    placeholder={t('searchPhone') || 'Search by phone'}
                    className="w-full text-sm"
                  />
                </div>
                <div>
                  <label htmlFor="search-name" className="block text-xs font-medium text-gray-700 mb-1.5">
                    {tCommon('name') || 'Name'}
                  </label>
                  <CmxInput
                    id="search-name"
                    type="text"
                    value={searchName}
                    onChange={(e) => setSearchName(e.target.value)}
                    dir={isRTL ? 'rtl' : 'ltr'}
                    placeholder={t('searchName') || 'Search by name'}
                    className="w-full text-sm"
                  />
                </div>
                <div>
                  <label htmlFor="search-email" className="block text-xs font-medium text-gray-700 mb-1.5">
                    {tCommon('email') || 'Email'}
                  </label>
                  <CmxInput
                    id="search-email"
                    type="email"
                    value={searchEmail}
                    onChange={(e) => setSearchEmail(e.target.value)}
                    dir="ltr"
                    placeholder={t('searchEmail') || 'Search by email'}
                    className="w-full text-sm"
                  />
                </div>
              </div>
              <label
                className={`flex items-center gap-2 cursor-pointer select-none text-sm ${isRTL ? 'flex-row-reverse' : ''}`}
              >
                <input
                  type="checkbox"
                  checked={searchAllOptions}
                  onChange={(e) => setSearchAllOptions(e.target.checked)}
                  className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                  aria-describedby="customer-search-hint"
                />
                <span className="text-gray-700">{t('searchAllOptions')}</span>
              </label>
            </div>
          )}
        </div>

        {/* Divider */}
        <div className="border-t border-gray-200" />

        {/* Results - min-h-0 allows flex child to shrink so overflow-y-auto scrolls inside modal */}
        <div
          ref={resultsRef}
          id="customer-results-list"
          className="flex-1 min-h-0 overflow-y-auto px-6 py-4"
          role="listbox"
          aria-label={t('title')}
        >
          {displayError ? (
            <div className="flex flex-col items-center justify-center py-12" role="alert">
              <div className="w-16 h-16 rounded-full bg-red-50 flex items-center justify-center mb-4">
                <svg
                  className="w-8 h-8 text-red-500"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
              </div>
              <p className="text-red-600 text-sm font-medium mb-1">{t('error')}</p>
              <p className="text-red-500 text-sm text-center max-w-sm">{displayError}</p>
            </div>
          ) : !canSearch ? (
            <div className="flex flex-col items-center justify-center py-16">
              <div className="w-20 h-20 rounded-full bg-gray-100 flex items-center justify-center mb-4">
                <svg
                  className="w-10 h-10 text-gray-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                  />
                </svg>
              </div>
              <p className="text-gray-500 text-sm text-center max-w-sm">{t('searchHint')}</p>
            </div>
          ) : isLoading ? (
            <div className="flex flex-col items-center justify-center py-16">
              <div className="w-12 h-12 rounded-full border-4 border-gray-200 border-t-blue-500 animate-spin mb-4" />
              <p className="text-gray-500 text-sm">{tCommon('loading') || 'Searching...'}</p>
            </div>
          ) : customers.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12">
              <div className="w-20 h-20 rounded-full bg-gray-100 flex items-center justify-center mb-4">
                <svg
                  className="w-10 h-10 text-gray-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
                  />
                </svg>
              </div>
              <p className="text-gray-700 font-medium text-sm mb-1">{t('noCustomersFound')}</p>
              <p className="text-gray-500 text-xs mb-6 text-center max-w-sm">
                {t('noCustomersFoundHint') || 'Try different search terms or create a new customer'}
              </p>
              <CmxButton
                type="button"
                variant="primary"
                size="md"
                onClick={() => setCreateModalOpen(true)}
              >
                {t('createNewCustomer')}
              </CmxButton>
            </div>
          ) : (
            <div className="space-y-2" role="group" aria-live="polite" aria-atomic="true">
              {customers.map((customer, idx) => (
                <button
                  key={customer.id}
                  type="button"
                  role="option"
                  aria-selected={idx === focusedIndex}
                  onClick={() => handleCustomerClick(customer)}
                  className={`w-full ${isRTL ? 'text-right' : 'text-left'} p-4 border rounded-lg transition-all ${
                    idx === focusedIndex ? 'ring-2 ring-blue-500 border-blue-500 bg-blue-50' : ''
                  } ${
                    customer.source === 'current_tenant'
                      ? 'border-gray-200 bg-white hover:bg-gray-50 hover:border-gray-300'
                      : customer.source === 'sys_global'
                        ? 'border-amber-200 bg-amber-50/50 hover:bg-amber-50 hover:border-amber-300'
                        : 'border-violet-200 bg-violet-50/50 hover:bg-violet-50 hover:border-violet-300'
                  }`}
                >
                  <div className={`flex items-center gap-3 ${isRTL ? 'flex-row-reverse' : ''}`}>
                    <div className="shrink-0 w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center">
                      <UserCircle className="w-6 h-6 text-gray-500" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-gray-900 truncate">
                        {customer.name ||
                          customer.name2 ||
                          customer.displayName ||
                          `${customer.firstName || ''} ${customer.lastName || ''}`.trim() ||
                          t('unnamed')}
                      </div>
                      {(customer.phone || customer.email) && (
                        <div
                          className={`text-sm text-gray-600 mt-0.5 truncate ${isRTL ? 'text-right' : 'text-left'}`}
                        >
                          {customer.phone && <span>{customer.phone}</span>}
                          {customer.phone && customer.email && <span className="mx-1">•</span>}
                          {customer.email && <span>{customer.email}</span>}
                        </div>
                      )}
                    </div>
                    {customer.source === 'sys_global' && (
                      <span className="shrink-0 px-2.5 py-1 text-xs font-medium bg-amber-100 text-amber-800 rounded-full">
                        {t('global')}
                      </span>
                    )}
                    {customer.source === 'other_tenant' && (
                      <span className="shrink-0 px-2.5 py-1 text-xs font-medium bg-violet-100 text-violet-800 rounded-full">
                        {t('otherTenant')}
                      </span>
                    )}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-gray-200 p-4 bg-gray-50">
          <div className={`flex gap-3 ${isRTL ? 'flex-row-reverse' : ''}`}>
            <CmxButton
              type="button"
              variant="secondary"
              size="md"
              onClick={handleClose}
              className="flex-1 sm:flex-initial"
            >
              {tCommon('cancel')}
            </CmxButton>
          </div>
        </div>
      </div>

      {/* Confirmation Dialog */}
      {showConfirmDialog && linkingCustomer && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4"
          role="alertdialog"
          aria-modal="true"
        >
          <div className="bg-white rounded-xl max-w-md w-full p-6 shadow-xl border border-gray-200">
            <h3 className={`text-lg font-semibold mb-4 ${isRTL ? 'text-right' : 'text-left'}`}>
              {t('confirmLink')}
            </h3>
            <p className={`text-gray-600 mb-6 text-sm ${isRTL ? 'text-right' : 'text-left'}`}>
              {linkingCustomer.source === 'sys_global'
                ? t('confirmLinkGlobal')
                : t('confirmLinkOtherTenant')}
            </p>
            <div className={`flex gap-3 ${isRTL ? 'flex-row-reverse' : ''}`}>
              <button
                type="button"
                onClick={() => {
                  setShowConfirmDialog(false);
                  setLinkingCustomer(null);
                }}
                disabled={linkLoading}
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 text-sm font-medium"
              >
                {tCommon('cancel')}
              </button>
              <button
                type="button"
                onClick={handleLinkCustomer}
                disabled={linkLoading}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 text-sm font-medium"
              >
                {linkLoading
                  ? t('linking')
                  : linkingCustomer.source === 'sys_global'
                    ? t('linkCustomer')
                    : t('copyCustomer')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Customer Create Modal */}
      <CustomerCreateModal
        open={createModalOpen}
        onClose={() => {
          setCreateModalOpen(false);
          setCreateError(null);
        }}
        tenantId={tenantId}
        onSuccess={async (createdCustomer: CustomerType) => {
          try {
            const searchTerm = createdCustomer.phone || createdCustomer.firstName || '';

            if (!searchTerm) {
              setCreateError('Failed to find created customer. Please search manually.');
              setCreateModalOpen(false);
              return;
            }

            await new Promise((resolve) => setTimeout(resolve, 400));

            let orgCustomer: Customer | null = null;
            for (let attempt = 0; attempt < 3; attempt++) {
              const results = await searchCustomersForPicker({
                search: searchTerm,
                searchAllOptions: false,
                limit: 10,
              });

              const found = results.find((c) => {
                if (createdCustomer.phone) return c.phone === createdCustomer.phone;
                return c.firstName === createdCustomer.firstName;
              });

              if (found) {
                orgCustomer = mapSearchItemToCustomer(found);
                break;
              }
              await new Promise((resolve) => setTimeout(resolve, 500));
            }

            if (!orgCustomer) {
              throw new Error('Created customer not found. Please search manually.');
            }

            const formatted: Customer = {
              ...orgCustomer,
              source: 'current_tenant',
              belongsToCurrentTenant: true,
            };

            onSelectCustomer(formatted);
            setCreateModalOpen(false);
            setSearch('');
            setCreateError(null);
          } catch (err) {
            console.error('Failed to find created customer:', err);
            setCreateError(err instanceof Error ? err.message : 'Failed to find created customer.');
            setCreateModalOpen(false);
          }
        }}
      />
    </div>
  );
}
