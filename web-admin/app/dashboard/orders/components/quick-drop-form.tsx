/**
 * Quick Drop Form Component
 *
 * Form for creating Quick Drop orders.
 */

'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useRTL } from '@/lib/hooks/useRTL';
import { useBilingual } from '@/lib/hooks/useBilingual';
import { createOrder } from '@/app/actions/orders/create-order';
import { fetchCustomers } from '@/lib/api/customers';
import type { CustomerListItem } from '@/lib/types/customer';

export function QuickDropForm() {
  const router = useRouter();
  const t = useTranslations('orders.quickDrop');
  const tCommon = useTranslations('common');
  const isRTL = useRTL();
  const getBilingual = useBilingual();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [customerQuery, setCustomerQuery] = useState('');
  const [customerResults, setCustomerResults] = useState<CustomerListItem[]>([]);
  const [customerDropdownOpen, setCustomerDropdownOpen] = useState(false);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('');
  const customerInputRef = useRef<HTMLInputElement | null>(null);

  // TODO: Get tenant ID from session
  const tenantOrgId = 'demo-tenant-id';

  // Debounced search for customers
  useEffect(() => {
    let cancelled = false;
    const handler = setTimeout(async () => {
      if (!customerQuery || customerQuery.trim().length < 2) {
        setCustomerResults([]);
        return;
      }
      try {
        const { customers } = await fetchCustomers({ search: customerQuery, limit: 5, page: 1 });
        if (!cancelled) setCustomerResults(customers);
      } catch (e) {
        // do nothing; keep UX silent
      }
    }, 250);

    return () => {
      cancelled = true;
      clearTimeout(handler);
    };
  }, [customerQuery]);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    const formData = new FormData(e.currentTarget);

    try {
      const result = await createOrder(tenantOrgId, formData);

      if (result.success && result.data) {
        // Redirect to preparation page
        router.push(`/dashboard/orders/${result.data.id}/prepare`);
      } else {
        setError(result.error || t('errors.createFailed'));
      }
    } catch (err) {
      setError(t('errors.unexpectedError'));
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className={`space-y-6 bg-white rounded-lg border border-gray-200 p-6 ${isRTL ? 'text-right' : 'text-left'}`}>
      {/* Error Message */}
      {error && (
        <div className={`bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded ${isRTL ? 'text-right' : 'text-left'}`}>
          {error}
        </div>
      )}

      {/* Customer Selection */}
      <div>
        <label htmlFor="customerId" className={`block text-sm font-medium text-gray-700 mb-2 ${isRTL ? 'text-right' : 'text-left'}`}>
          {t('customer')} *
        </label>
        {/* hidden field for selected id */}
        <input type="hidden" name="customerId" value={selectedCustomerId} />
        <div className="relative">
          <input
            ref={customerInputRef}
            type="text"
            value={customerQuery}
            onChange={(e) => {
              setCustomerQuery(e.target.value);
              setCustomerDropdownOpen(true);
              setSelectedCustomerId('');
            }}
            onFocus={() => setCustomerDropdownOpen(true)}
            placeholder={t('customerPlaceholder')}
            dir={isRTL ? 'rtl' : 'ltr'}
            className={`w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 ${isRTL ? 'text-right' : 'text-left'}`}
            aria-autocomplete="list"
            aria-expanded={customerDropdownOpen}
          />
          {customerDropdownOpen && customerResults.length > 0 && (
            <ul className={`absolute z-10 mt-1 max-h-56 w-full overflow-auto rounded-md border border-gray-200 bg-white shadow-lg ${isRTL ? 'text-right' : 'text-left'}`}>
              {customerResults.map((c) => (
                <li key={c.id}>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedCustomerId(c.id);
                      setCustomerQuery(`${getBilingual(c.name, c.name2) || c.displayName || (c.firstName && c.lastName ? `${c.firstName} ${c.lastName}` : '') || ''}${c.phone ? ' • ' + c.phone : ''}`);
                      setCustomerDropdownOpen(false);
                    }}
                    className={`block w-full ${isRTL ? 'text-right' : 'text-left'} px-3 py-2 hover:bg-gray-900 hover:text-blue-500`}
                  > 
                    <div className="text-sm text-gray-900">{getBilingual(c.name, c.name2) || c.displayName || (c.firstName && c.lastName ? `${c.firstName} ${c.lastName}` : '') || t('unnamed')}</div>
                    <div className="text-xs text-gray-500">{c.phone || c.email || c.customerNumber || c.id}</div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
        {!selectedCustomerId && (
          <p className={`text-xs text-red-600 mt-1 ${isRTL ? 'text-right' : 'text-left'}`}>{t('selectCustomerToContinue')}</p>
        )}
      </div>

      {/* Service Category */}
      <div>
        <label htmlFor="serviceCategory" 
        className={`block text-sm font-medium text-gray-700 mb-2 ${isRTL ? 'text-right' : 'text-left'}`}>
          {t('serviceCategory')} *
        </label>
        <select
          id="serviceCategory"
          name="serviceCategory"
          required
          dir={isRTL ? 'rtl' : 'ltr'}
          className={`w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 ${isRTL ? 'text-right' : 'text-left'}`}
        >
          <option value="">{t('selectService')}</option>
          <option value="WASH_AND_IRON">{t('services.washAndFold')}</option>
          <option value="DRY_CLEAN">{t('services.dryClean')}</option>
          <option value="IRON_ONLY">{t('services.ironOnly')}</option>
          <option value="REPAIRS">{t('services.repairs')}</option>
          <option value="ALTERATION">{t('services.alterations')}</option>
        </select>
      </div>

      {/* Bag Count */}
      <div>
        <label htmlFor="bagCount" className={`block text-sm font-medium text-gray-700 mb-2 ${isRTL ? 'text-right' : 'text-left'}`}>
          {t('bagCount')} *
        </label>
        <input
          type="number"
          id="bagCount"
          name="bagCount"
          required
          min="1"
          max="100"
          defaultValue="1"
          dir="ltr"
          className={`w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 ${isRTL ? 'text-right' : 'text-left'}`}
        />
      </div>

      {/* Priority */}
      <div>
        <label htmlFor="priority" className={`block text-sm font-medium text-gray-700 mb-2 ${isRTL ? 'text-right' : 'text-left'}`}>
          {t('priority')} *
        </label>
        <select
          id="priority"
          name="priority"
          defaultValue="normal"
          dir={isRTL ? 'rtl' : 'ltr'}
          className={`w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 ${isRTL ? 'text-right' : 'text-left'}`}
        >
          <option value="normal">{t('priorities.normal')}</option>
          <option value="urgent">{t('priorities.urgent')}</option>
          <option value="express">{t('priorities.express')}</option>
        </select>
      </div>

      {/* Customer Notes */}
      <div>
        <label htmlFor="customerNotes" className={`block text-sm font-medium text-gray-700 mb-2 ${isRTL ? 'text-right' : 'text-left'}`}>
          {t('customerNotes')}
        </label>
        <textarea
          id="customerNotes"
          name="customerNotes"
          rows={3}
          placeholder={t('customerNotesPlaceholder')}
          dir={isRTL ? 'rtl' : 'ltr'}
          className={`w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 ${isRTL ? 'text-right' : 'text-left'}`}
        />
      </div>

      {/* Internal Notes */}
      <div>
        <label htmlFor="internalNotes" className={`block text-sm font-medium text-gray-700 mb-2 ${isRTL ? 'text-right' : 'text-left'}`}>
          {t('internalNotes')}
        </label>
        <textarea
          id="internalNotes"
          name="internalNotes"
          rows={2}
          placeholder={t('internalNotesPlaceholder')}
          dir={isRTL ? 'rtl' : 'ltr'}
          className={`w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 ${isRTL ? 'text-right' : 'text-left'}`}
        />
      </div>

      {/* Photo Upload */}
      <div>
        <label className={`block text-sm font-medium text-gray-700 mb-2 ${isRTL ? 'text-right' : 'text-left'}`}>
          {t('orderPhotos')} ({tCommon('optional')})
        </label>
        <div className={`border-2 border-dashed border-gray-300 rounded-lg p-6 text-center ${isRTL ? 'text-right' : 'text-left'}`}>
          <p className="text-gray-500">
            📸 {t('photoUploadComingSoon')}
          </p>
          <p className="text-sm text-gray-400 mt-1">
            {t('dragAndDropOrClick')}
          </p>
        </div>
      </div>

      {/* Actions */}
      <div className={`flex gap-3 pt-4 border-t border-gray-200 ${isRTL ? 'flex-row-reverse' : ''}`}>
        <button
          type="submit"
          disabled={loading}
          className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? t('creatingOrder') : t('createAndContinue')}
        </button>
        <button
          type="button"
          onClick={() => router.back()}
          className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
        >
          {tCommon('cancel')}
        </button>
      </div>
    </form>
  );
}
