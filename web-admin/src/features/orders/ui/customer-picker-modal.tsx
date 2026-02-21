/**
 * Customer Picker Modal Component
 * Search and select customer with progressive search
 * PRD-010: New Order UI
 * Refactored for fast search, React Query caching, keyboard nav, best UX
 */

'use client';

import { useState, useCallback, useRef, useEffect, useDeferredValue } from 'react';
import { useTranslations } from 'next-intl';
import { useRTL } from '@/lib/hooks/useRTL';
import {
  useCustomerSearch,
  CUSTOMER_SEARCH_MIN_CHARS,
} from '@/lib/hooks/use-customer-search';
import { searchCustomersForPicker } from '@/lib/api/customers';
import { CmxInput } from '@ui/primitives/cmx-input';
import { CustomerCreateModal } from './customer-create-modal';
import type { Customer as CustomerType } from '@/lib/types/customer';
import type { CustomerSearchItem } from '@/lib/api/customers';

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
}

export function CustomerPickerModal({ open, onClose, onSelectCustomer }: CustomerPickerModalProps) {
  const t = useTranslations('newOrder.customerPicker');
  const tCommon = useTranslations('common');
  const isRTL = useRTL();
  const [search, setSearch] = useState('');
  const [searchAllOptions, setSearchAllOptions] = useState(false);
  const [linkingCustomer, setLinkingCustomer] = useState<Customer | null>(null);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [linkLoading, setLinkLoading] = useState(false);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [focusedIndex, setFocusedIndex] = useState(0);
  const resultsRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Defer search term used for API/list so input stays responsive (fixes INP)
  const deferredSearch = useDeferredValue(search);
  const { customers: rawCustomers, isLoading, isFetching, error, isReady } = useCustomerSearch({
    search: deferredSearch,
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
      setCreateError(null);
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [open]);

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
  const canSearch = search.trim().length >= CUSTOMER_SEARCH_MIN_CHARS;
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
        className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[85vh] flex flex-col border border-gray-200"
        onKeyDown={handleKeyDown}
      >
        {/* Header */}
        <div className="p-6 border-b border-gray-100">
          <h2
            id="customer-picker-title"
            className={`text-xl font-semibold text-gray-900 ${isRTL ? 'text-right' : 'text-left'}`}
          >
            {t('title')}
          </h2>
          <p
            id="customer-picker-desc"
            className={`text-gray-600 text-sm mt-1 ${isRTL ? 'text-right' : 'text-left'}`}
          >
            {t('description')}
          </p>
        </div>

        {/* Search */}
        <div className="p-6 border-b border-gray-100 space-y-3">
          <div className="relative">
            <CmxInput
              ref={inputRef}
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              dir={isRTL ? 'rtl' : 'ltr'}
              placeholder={t('searchPlaceholder')}
              className={`w-full px-4 py-2.5 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors ${
                isRTL ? 'text-right' : 'text-left'
              }`}
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
          <p id="customer-search-hint" className="text-xs text-gray-500">
            {t('searchHint')}
          </p>
          <label
            className={`flex items-center gap-2 cursor-pointer select-none ${isRTL ? 'flex-row-reverse' : ''}`}
          >
            <input
              type="checkbox"
              checked={searchAllOptions}
              onChange={(e) => setSearchAllOptions(e.target.checked)}
              className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
              aria-describedby="customer-search-hint"
            />
            <span className="text-sm text-gray-700">{t('searchAllOptions')}</span>
          </label>
        </div>

        {/* Results */}
        <div
          ref={resultsRef}
          id="customer-results-list"
          className="flex-1 overflow-y-auto p-6 min-h-[200px]"
          role="listbox"
          aria-label={t('title')}
        >
          {displayError ? (
            <div
              className={`py-8 text-red-600 text-sm ${isRTL ? 'text-right' : 'text-center'}`}
              role="alert"
            >
              {t('error')}: {displayError}
            </div>
          ) : !canSearch ? (
            <div
              className={`py-8 text-gray-500 text-sm ${isRTL ? 'text-right' : 'text-center'}`}
              id="customer-search-empty"
            >
              {t('searchHint')}
            </div>
          ) : customers.length === 0 && !isLoading ? (
            <div className={`py-8 space-y-4 ${isRTL ? 'text-right' : 'text-center'}`}>
              <p className="text-gray-500 text-sm">{t('noCustomersFound')}</p>
              <button
                type="button"
                onClick={() => setCreateModalOpen(true)}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
              >
                {t('createNewCustomer')}
              </button>
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
                    idx === focusedIndex ? 'ring-2 ring-blue-500 ring-offset-1 border-blue-500' : ''
                  } ${
                    customer.source === 'current_tenant'
                      ? 'border-gray-200 hover:bg-blue-50/80 hover:border-blue-300'
                      : customer.source === 'sys_global'
                        ? 'border-amber-200 bg-amber-50/80 hover:bg-amber-100 hover:border-amber-300'
                        : 'border-violet-200 bg-violet-50/80 hover:bg-violet-100 hover:border-violet-300'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
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
                          {customer.phone && customer.email && <span> • </span>}
                          {customer.email && <span>{customer.email}</span>}
                        </div>
                      )}
                    </div>
                    {customer.source === 'sys_global' && (
                      <span className="shrink-0 px-2 py-0.5 text-xs font-medium bg-amber-200 text-amber-800 rounded">
                        {t('global')}
                      </span>
                    )}
                    {customer.source === 'other_tenant' && (
                      <span className="shrink-0 px-2 py-0.5 text-xs font-medium bg-violet-200 text-violet-800 rounded">
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
        <div
          className={`p-4 border-t border-gray-100 flex ${isRTL ? 'justify-start' : 'justify-end'}`}
        >
          <button
            type="button"
            onClick={handleClose}
            className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 text-sm font-medium"
          >
            {tCommon('cancel')}
          </button>
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
