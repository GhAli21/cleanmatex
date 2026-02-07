'use client';

import { useTranslations } from 'next-intl';
import { useRouter, useSearchParams } from 'next/navigation';
import { useState, useTransition, useCallback } from 'react';
import { VOUCHER_STATUS, VOUCHER_CATEGORY, VOUCHER_TYPE } from '@/lib/constants/voucher';

const STATUS_OPTIONS = Object.values(VOUCHER_STATUS);
const CATEGORY_OPTIONS = Object.values(VOUCHER_CATEGORY);
const TYPE_OPTIONS = Object.values(VOUCHER_TYPE);

export default function VoucherFiltersBar() {
  const t = useTranslations('billing.receiptVoucher');
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
      router.push('/dashboard/billing/vouchers');
    });
  };

  const hasFilters = searchParams.toString() !== '';

  const currentStatus = searchParams.get('status') || '';
  const currentCategory = searchParams.get('voucherCategory') || '';
  const currentType = searchParams.get('voucherType') || '';
  const currentStartDate = searchParams.get('startDate') || '';
  const currentEndDate = searchParams.get('endDate') || '';

  return (
    <div className="space-y-3 rounded-lg border border-gray-200 bg-white p-4">
      {/* Row 1: Search + Clear */}
      <div className="flex flex-col gap-3 md:flex-row md:items-center">
        <div className="flex flex-1 gap-2">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleSearch();
            }}
            placeholder={t('searchPlaceholder') ?? 'Search by voucher #, invoice #, order #...'}
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

      {/* Row 2: Dropdowns + Date Range */}
      <div className="flex flex-wrap gap-3">
        {/* Status Filter */}
        <select
          value={currentStatus}
          onChange={(e) => updateParams({ status: e.target.value || null })}
          className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        >
          <option value="">{t('allStatuses') ?? 'All Statuses'}</option>
          {STATUS_OPTIONS.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>

        {/* Category Filter */}
        <select
          value={currentCategory}
          onChange={(e) => updateParams({ voucherCategory: e.target.value || null })}
          className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        >
          <option value="">{t('allCategories') ?? 'All Categories'}</option>
          {CATEGORY_OPTIONS.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>

        {/* Type Filter */}
        <select
          value={currentType}
          onChange={(e) => updateParams({ voucherType: e.target.value || null })}
          className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        >
          <option value="">{t('allTypes') ?? 'All Types'}</option>
          {TYPE_OPTIONS.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>

        {/* Date Range */}
        <div className="flex gap-2">
          <input
            type="date"
            value={currentStartDate}
            onChange={(e) => updateParams({ startDate: e.target.value || null })}
            className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            placeholder={tCommon('dateFrom')}
          />
          <input
            type="date"
            value={currentEndDate}
            onChange={(e) => updateParams({ endDate: e.target.value || null })}
            className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            placeholder={tCommon('dateTo')}
          />
        </div>
      </div>
    </div>
  );
}
