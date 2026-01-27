/**
 * Customer Picker Modal Component
 * Search and select customer with progressive search
 * PRD-010: New Order UI
 */

'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { useRTL } from '@/lib/hooks/useRTL';
import { CustomerCreateModal } from './customer-create-modal';
import type { Customer as CustomerType } from '@/lib/types/customer';

interface Customer {
  id: string; 
  name?: string;
  name2?: string;
  displayName?: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
  email?: string;
  // Progressive search metadata
  source?: 'current_tenant' | 'sys_global' | 'other_tenant';
  belongsToCurrentTenant?: boolean;
  originalTenantId?: string;
  customerId?: string; // sys_customers_mst.id if linked to global customer
  orgCustomerId?: string; // org_customers_mst.id (for other tenant source)
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
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [linkingCustomer, setLinkingCustomer] = useState<Customer | null>(null);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [linkLoading, setLinkLoading] = useState(false);
  const [createModalOpen, setCreateModalOpen] = useState(false);

  useEffect(() => {
    // AbortController to cancel previous requests
    const abortController = new AbortController();

    const loadCustomers = async () => {
      if (!search || search.length < 2) {
        setCustomers([]);
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);
      try {
        const res = await fetch(
          `/api/v1/customers?search=${encodeURIComponent(search)}&limit=10&searchAllOptions=${searchAllOptions}`,
          { signal: abortController.signal }
        );
        
        if (!res.ok) {
          const errorData = await res.json().catch(() => ({}));
          throw new Error(errorData.error || `HTTP error! status: ${res.status}`);
        }

        const json = await res.json();
        
        if (json.success && json.data?.customers) {
          // Map CustomerListItem to Customer interface with source metadata
          const mappedCustomers = json.data.customers.map((c: {
            id: string;
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
          }) => ({
            id: c.id,
            name: c.displayName || `${c.firstName || ''} ${c.lastName || ''}`.trim() || undefined,
            name2: undefined, // CustomerListItem doesn't have name2
            displayName: c.displayName,
            firstName: c.firstName,
            lastName: c.lastName,
            phone: c.phone,
            email: c.email,
            source: c.source,
            belongsToCurrentTenant: c.belongsToCurrentTenant,
            originalTenantId: c.originalTenantId,
            customerId: c.customerId,
            orgCustomerId: c.orgCustomerId,
          }));
          setCustomers(mappedCustomers);
          setError(null);
        } else if (json.data && Array.isArray(json.data)) {
          // Fallback: handle case where data is directly an array
          const mappedCustomers = json.data.map((c: {
            id: string;
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
          }) => ({
            id: c.id,
            name: c.displayName || `${c.firstName || ''} ${c.lastName || ''}`.trim() || undefined,
            name2: undefined,
            displayName: c.displayName,
            firstName: c.firstName,
            lastName: c.lastName,
            phone: c.phone,
            email: c.email,
            source: c.source,
            belongsToCurrentTenant: c.belongsToCurrentTenant,
            originalTenantId: c.originalTenantId,
            customerId: c.customerId,
            orgCustomerId: c.orgCustomerId,
          }));
          setCustomers(mappedCustomers);
          setError(null);
        } else {
          setCustomers([]);
          if (!json.success && json.error) {
            setError(json.error);
          }
        }
      } catch (err: unknown) {
        // Ignore abort errors (expected when canceling requests)
        if (err instanceof Error && err.name !== 'AbortError') {
          console.error('Failed to load customers:', err);
          setCustomers([]);
          setError(err.message || 'Failed to load customers');
        } else if (!(err instanceof Error) || err.name !== 'AbortError') {
          setCustomers([]);
          setError('Failed to load customers');
        }
      } finally {
        setLoading(false);
      }
    };

    // Debounce search with 500ms delay to reduce API calls
    const timeoutId = setTimeout(loadCustomers, 500);

    // Cleanup: cancel timeout and abort request
    return () => {
      clearTimeout(timeoutId);
      abortController.abort();
    };
  }, [search, searchAllOptions]);

  const handleLinkCustomer = async () => {
    if (!linkingCustomer) return;

    setLinkLoading(true);
    setError(null); // Clear any previous errors
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

      // For other_tenant source, originalTenantId is required
      if (isOtherTenant) {
        if (!linkingCustomer.originalTenantId) {
          throw new Error('Missing tenant information for customer linking');
        }
        body.originalTenantId = linkingCustomer.originalTenantId;
      }
      
      // Validate customerId is present
      if (!body.customerId) {
        throw new Error('Invalid customer ID');
      }

      const res = await fetch('/api/v1/customers/link', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });

      const json = await res.json() as { success: boolean; data?: { orgCustomerId: string; customerId: string }; error?: string };

      if (!res.ok || !json.success) {
        throw new Error(json.error || 'Failed to link customer');
      }

      // Select the customer using the new orgCustomerId
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
      setCustomers([]);
    } catch (err: unknown) {
      console.error('Failed to link customer:', err);
      setError(err instanceof Error ? err.message : 'Failed to link customer');
    } finally {
      setLinkLoading(false);
    }
  };

  const handleCustomerClick = (customer: Customer) => {
    // If customer belongs to current tenant, select immediately
    if (customer.source === 'current_tenant' || customer.belongsToCurrentTenant) {
      onSelectCustomer(customer);
      setSearch('');
      setCustomers([]);
      return;
    }

    // Otherwise, show confirmation dialog
    setLinkingCustomer(customer);
    setShowConfirmDialog(true);
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-2xl w-full max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="p-6 border-b border-gray-200">
          <h2 className={`text-2xl font-bold ${isRTL ? 'text-right' : 'text-left'}`}>{t('title')}</h2>
          <p className={`text-gray-600 mt-1 ${isRTL ? 'text-right' : 'text-left'}`}>{t('description')}</p>
        </div>

        {/* Search */}
        <div className="p-6 border-b border-gray-200 space-y-3">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            dir={isRTL ? 'rtl' : 'ltr'}
            placeholder={t('searchPlaceholder')}
            className={`w-full px-4 py-2 border border-gray-300 rounded-lg ${isRTL ? 'text-right' : 'text-left'}`}
            autoFocus
          />
          <label className={`flex items-center gap-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
            <input
              type="checkbox"
              checked={searchAllOptions}
              onChange={(e) => setSearchAllOptions(e.target.checked)}
              className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
            />
            <span className="text-sm text-gray-700">
              {t('searchAllOptions') || 'Search all options'}
            </span>
          </label>
        </div> 

        {/* Results */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className={`${isRTL ? 'text-right' : 'text-center'} py-8 text-gray-500`}>{t('loading')}</div>
          ) : error ? (
            <div className={`${isRTL ? 'text-right' : 'text-center'} py-8 text-red-500`}>
              {t('error') || 'Error'}: {error}
            </div>
          ) : search.length < 2 ? (
            <div className={`${isRTL ? 'text-right' : 'text-center'} py-8 text-gray-500`}>
              {t('searchHint') || 'Type at least 2 characters to search'}
            </div>
          ) : customers.length === 0 ? (
            <div className={`${isRTL ? 'text-right' : 'text-center'} py-8 space-y-4`}>
              <div className="text-gray-500">{t('noCustomersFound')}</div>
              <button
                onClick={() => setCreateModalOpen(true)}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                {t('createNewCustomer') || 'Create New Customer'}
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              {customers.map((customer) => (
                <button
                  key={customer.id}
                  onClick={() => handleCustomerClick(customer)}
                  className={`w-full ${isRTL ? 'text-right' : 'text-left'} p-4 border rounded-lg transition-all ${
                    customer.source === 'current_tenant'
                      ? 'border-gray-200 hover:bg-blue-50 hover:border-blue-500'
                      : customer.source === 'sys_global'
                      ? 'border-yellow-200 bg-yellow-50 hover:bg-yellow-100 hover:border-yellow-300'
                      : 'border-purple-200 bg-purple-50 hover:bg-purple-100 hover:border-purple-300'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="font-medium">
                        {customer.name || customer.name2 || customer.displayName || `${customer.firstName || ''} ${customer.lastName || ''}`.trim() || t('unnamed')}
                      </div>
                      {(customer.phone || customer.email) && (
                        <div className={`text-sm text-gray-600 mt-1 ${isRTL ? 'text-right' : 'text-left'}`}>
                          {customer.phone && <span>{customer.phone}</span>}
                          {customer.phone && customer.email && <span> • </span>}
                          {customer.email && <span>{customer.email}</span>}
                        </div>
                      )}
                    </div>
                    {customer.source === 'sys_global' && (
                      <span className="ml-2 px-2 py-1 text-xs font-medium bg-yellow-200 text-yellow-800 rounded">
                        {t('global') || 'Global'}
                      </span>
                    )}
                    {customer.source === 'other_tenant' && (
                      <span className="ml-2 px-2 py-1 text-xs font-medium bg-purple-200 text-purple-800 rounded">
                        {t('otherTenant') || 'Other Tenant'}
                      </span>
                    )}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className={`p-6 border-t border-gray-200 flex ${isRTL ? 'justify-start' : 'justify-end'}`}>
          <button
            onClick={() => {
              onClose();
              setSearch('');
              setCustomers([]);
              setShowConfirmDialog(false);
              setLinkingCustomer(null);
            }}
            className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            {tCommon('cancel')}
          </button>
        </div>
      </div>

      {/* Confirmation Dialog */}
      {showConfirmDialog && linkingCustomer && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60] p-4">
          <div className="bg-white rounded-lg max-w-md w-full p-6">
            <h3 className={`text-xl font-bold mb-4 ${isRTL ? 'text-right' : 'text-left'}`}>
              {t('confirmLink') || 'Link Customer'}
            </h3>
            <p className={`text-gray-600 mb-6 ${isRTL ? 'text-right' : 'text-left'}`}>
              {linkingCustomer.source === 'sys_global'
                ? t('confirmLinkGlobal') || 'This customer is from the global database. Link them to your tenant?'
                : t('confirmLinkOtherTenant') || 'This customer belongs to another tenant. Copy and link them to your tenant?'}
            </p>
            <div className={`flex gap-3 ${isRTL ? 'flex-row-reverse' : ''}`}>
              <button
                onClick={() => {
                  setShowConfirmDialog(false);
                  setLinkingCustomer(null);
                }}
                disabled={linkLoading}
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
              >
                {tCommon('cancel')}
              </button>
              <button
                onClick={handleLinkCustomer}
                disabled={linkLoading}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                {linkLoading
                  ? (t('linking') || 'Linking...')
                  : linkingCustomer.source === 'sys_global'
                  ? (t('linkCustomer') || 'Link Customer')
                  : (t('copyCustomer') || 'Copy Customer')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Customer Create Modal */}
      <CustomerCreateModal
        open={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        onSuccess={async (createdCustomer: CustomerType) => {
          // After customer creation, search for the org customer to get org_customers_mst.id
          try {
            // Use phone number if available, otherwise use name
            const searchTerm = createdCustomer.phone || createdCustomer.firstName || '';
            
            if (!searchTerm) {
              console.error('Cannot search for customer without phone or name');
              setError('Failed to find created customer. Please search manually.');
              setCreateModalOpen(false);
              return;
            }

            // Add a small delay to ensure database transaction is committed
            await new Promise(resolve => setTimeout(resolve, 300));

            // Search for the customer to get org_customers_mst record with retry logic
            let orgCustomer: Customer | null = null;
            let attempts = 0;
            const maxAttempts = 3;

            while (!orgCustomer && attempts < maxAttempts) {
              attempts++;
              
              const searchResponse = await fetch(
                `/api/v1/customers?search=${encodeURIComponent(searchTerm)}&limit=10&searchAllOptions=false`
              );

              if (!searchResponse.ok) {
                if (attempts === maxAttempts) {
                  throw new Error('Failed to search for created customer');
                }
                await new Promise(resolve => setTimeout(resolve, 500));
                continue;
              }

              const searchData = await searchResponse.json();
              
              if (searchData.success && searchData.data?.customers && searchData.data.customers.length > 0) {
                // Find the customer we just created (match by phone or firstName)
                orgCustomer = searchData.data.customers.find((c: Customer) => {
                  if (createdCustomer.phone) {
                    return c.phone === createdCustomer.phone;
                  }
                  return c.firstName === createdCustomer.firstName;
                });
              }

              if (!orgCustomer && attempts < maxAttempts) {
                // Wait before retrying
                await new Promise(resolve => setTimeout(resolve, 500));
              }
            }

            if (!orgCustomer) {
              throw new Error('Created customer not found in search results. Please try searching manually.');
            }

            // Format customer for picker
            const formattedCustomer: Customer = {
              id: orgCustomer.id, // This is org_customers_mst.id
              name: orgCustomer.displayName || `${orgCustomer.firstName || ''} ${orgCustomer.lastName || ''}`.trim() || undefined,
              name2: orgCustomer.name2 || undefined,
              displayName: orgCustomer.displayName,
              firstName: orgCustomer.firstName,
              lastName: orgCustomer.lastName,
              phone: orgCustomer.phone,
              email: orgCustomer.email,
              source: 'current_tenant',
              belongsToCurrentTenant: true,
            };

            // Select the customer and close modals
            onSelectCustomer(formattedCustomer);
            setCreateModalOpen(false);
            setSearch('');
            setCustomers([]);
            setError(null);
          } catch (err) {
            console.error('Failed to find created customer:', err);
            setError(err instanceof Error ? err.message : 'Failed to find created customer. Please search manually.');
            setCreateModalOpen(false);
          }
        }}
      />
    </div>
  );
}

