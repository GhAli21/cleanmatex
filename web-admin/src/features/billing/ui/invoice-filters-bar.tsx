'use client';

import { useTranslations } from 'next-intl';
import { useRouter, useSearchParams } from 'next/navigation';
import { useState, useTransition, useCallback } from 'react';

const STATUS_OPTIONS = ['pending', 'paid', 'partial', 'overdue', 'draft', 'cancelled', 'refunded'] as const;

export default function InvoiceFiltersBar() {
  const t = useTranslations('invoices.filters');
  const tCommon = useTranslations('common');
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const [searchQuery, setSearchQuery] = useState(searchParams.get('search') || '');

  const updateParams = useCallback(
    (updates: Record<string, string | null>) => {
      const params = new URLSearchParams(searchParams.toString());
      Object.entries(updates).forEach(([key, value]) => {
        if (value) {
          params.set(key, value);
        } else {
          params.delete(key);
        }
      });
      params.set('page', '1');
      startTransition(() => {
        router.push(`?${params.toString()}`);
      });
    },
    [searchParams, router],
  );

  const handleSearch = () => {
    updateParams({ search: searchQuery || null });
  };

  const handleClearFilters = () => {
    setSearchQuery('');
    startTransition(() => {
      router.push('/dashboard/billing/invoices');
    });
  };

  const hasFilters = searchParams.toString() !== '';

  const currentStatus = searchParams.get('status') || '';
  const currentFromDate = searchParams.get('fromDate') || '';
  const currentToDate = searchParams.get('toDate') || '';

  return (
    <div className="space-y-3 rounded-lg border border-gray-200 bg-white p-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-center">
        <div className="flex flex-1 gap-2">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleSearch();
            }}
            placeholder={t('search')}
            className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
          <button
            onClick={handleSearch}
            disabled={isPending}
            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {tCommon('search')}
          </button>
        </div>
        {hasFilters && (
          <button
            onClick={handleClearFilters}
            disabled={isPending}
            className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            {tCommon('clearFilters')}
          </button>
        )}
      </div>

      <div className="flex flex-wrap gap-3">
        <select
          value={currentStatus}
          onChange={(e) => updateParams({ status: e.target.value || null })}
          className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        >
          <option value="">{t('allStatuses')}</option>
          {STATUS_OPTIONS.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>

        <div className="flex items-center gap-1">
          <label className="text-xs text-gray-500">{t('fromDate')}</label>
          <input
            type="date"
            value={currentFromDate}
            onChange={(e) => updateParams({ fromDate: e.target.value || null })}
            className="rounded-md border border-gray-300 px-2 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>

        <div className="flex items-center gap-1">
          <label className="text-xs text-gray-500">{t('toDate')}</label>
          <input
            type="date"
            value={currentToDate}
            onChange={(e) => updateParams({ toDate: e.target.value || null })}
            className="rounded-md border border-gray-300 px-2 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>
      </div>
    </div>
  );
}
