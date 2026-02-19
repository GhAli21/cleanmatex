/**
 * Order Filters Bar Component
 *
 * Provides filters and search for orders list.
 */

'use client';

import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useRTL } from '@/lib/hooks/useRTL';

interface OrderFiltersBarProps {
  currentFilters: Record<string, string | undefined>;
}

export function OrderFiltersBar({ currentFilters }: OrderFiltersBarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const t = useTranslations('orders');
  const isRTL = useRTL();
  const [search, setSearch] = useState(currentFilters.search || '');

  const handleFilterChange = (key: string, value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (value) {
      params.set(key, value);
    } else {
      params.delete(key);
    }
    params.set('page', '1'); // Reset to first page
    router.push(`${pathname}?${params.toString()}`);
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    handleFilterChange('search', search);
  };

  const handleClearFilters = () => {
    router.push('/dashboard/orders');
    setSearch('');
  };

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4">
      <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
        {/* Search */}
        <form onSubmit={handleSearch} className="md:col-span-2">
          <input
            type="text"
            placeholder={t('search')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className={`w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 ${isRTL ? 'text-right' : 'text-left'}`}
            dir={isRTL ? 'rtl' : 'ltr'}
          />
        </form>

        {/* Status Filter */}
        <select
          value={currentFilters.status || ''}
          onChange={(e) => handleFilterChange('status', e.target.value)}
          className={`px-3 py-2 border border-gray-300 rounded-lg ${isRTL ? 'text-right' : 'text-left'}`}
          dir={isRTL ? 'rtl' : 'ltr'}
        >
          <option value="">{t('allStatuses')}</option>
          <option value="intake">{t('statuses.intake')}</option>
          <option value="preparation">{t('statuses.preparation')}</option>
          <option value="processing">{t('statuses.processing')}</option>
          <option value="ready">{t('statuses.ready')}</option>
          <option value="out_for_delivery">{t('statuses.outForDelivery')}</option>
          <option value="delivered">{t('statuses.delivered')}</option>
        </select>

        {/* Preparation Status Filter */}
        <select
          value={currentFilters.preparationStatus || ''}
          onChange={(e) => handleFilterChange('preparationStatus', e.target.value)}
          className={`px-3 py-2 border border-gray-300 rounded-lg ${isRTL ? 'text-right' : 'text-left'}`}
          dir={isRTL ? 'rtl' : 'ltr'}
        >
          <option value="">{t('allPrepStatuses')}</option>
          <option value="pending">{t('prepStatuses.pending')}</option>
          <option value="in_progress">{t('prepStatuses.inProgress')}</option>
          <option value="completed">{t('prepStatuses.completed')}</option>
        </select>

        {/* Priority Filter */}
        <select
          value={currentFilters.priority || ''}
          onChange={(e) => handleFilterChange('priority', e.target.value)}
          className={`px-3 py-2 border border-gray-300 rounded-lg ${isRTL ? 'text-right' : 'text-left'}`}
          dir={isRTL ? 'rtl' : 'ltr'}
        >
          <option value="">{t('allPriorities')}</option>
          <option value="normal">{t('priorities.normal')}</option>
          <option value="urgent">{t('priorities.urgent')}</option>
          <option value="express">{t('priorities.express')}</option>
        </select>

        {/* Retail Filter */}
        <select
          value={currentFilters.isRetail || ''}
          onChange={(e) => handleFilterChange('isRetail', e.target.value)}
          className={`px-3 py-2 border border-gray-300 rounded-lg ${isRTL ? 'text-right' : 'text-left'}`}
          dir={isRTL ? 'rtl' : 'ltr'}
        >
          <option value="">{t('allOrders')}</option>
          <option value="true">{t('retailOnly')}</option>
          <option value="false">{t('servicesOnly')}</option>
        </select>
      </div>

      {/* Clear Filters */}
      {(currentFilters.status ||
        currentFilters.preparationStatus ||
        currentFilters.priority ||
        currentFilters.isRetail ||
        currentFilters.search) && (
        <div className="mt-3">
          <button
            onClick={handleClearFilters}
            className="text-sm text-blue-600 hover:text-blue-700"
          >
            {t('clearAllFilters')}
          </button>
        </div>
      )}
    </div>
  );
}
