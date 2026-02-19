'use client';

import { useTranslations } from 'next-intl';
import { useRouter, useSearchParams } from 'next/navigation';
import { useState, useTransition, useCallback } from 'react';

const STATUS_OPTIONS = [
  'pending',
  'processing',
  'completed',
  'failed',
  'cancelled',
  'refunded',
] as const;

const METHOD_OPTIONS = [
  'CASH',
  'CARD',
  'CHECK',
  'BANK_TRANSFER',
  'PAY_ON_COLLECTION',
  'INVOICE',
  'MOBILE_PAYMENT',
  'HYPERPAY',
  'PAYTABS',
  'STRIPE',
] as const;

const KIND_OPTIONS = ['invoice', 'deposit', 'advance', 'pos'] as const;

export default function PaymentFiltersBar() {
  const t = useTranslations('payments.filters');
  const tStatuses = useTranslations('payments.statuses');
  const tKinds = useTranslations('payments.kinds');
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
      router.push('/dashboard/billing/payments');
    });
  };

  const hasFilters = searchParams.toString() !== '';

  const currentStatus = searchParams.get('status') || '';
  const currentMethod = searchParams.get('method') || '';
  const currentKind = searchParams.get('kind') || '';
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

      {/* Row 2: Dropdowns + Date Range */}
      <div className="flex flex-wrap gap-3">
        {/* Status Filter */}
        <select
          value={currentStatus}
          onChange={(e) => updateParams({ status: e.target.value || null })}
          className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        >
          <option value="">{t('allStatuses')}</option>
          {STATUS_OPTIONS.map((s) => (
            <option key={s} value={s}>
              {tStatuses(s)}
            </option>
          ))}
        </select>

        {/* Method Filter */}
        <select
          value={currentMethod}
          onChange={(e) => updateParams({ method: e.target.value || null })}
          className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        >
          <option value="">{t('allMethods')}</option>
          {METHOD_OPTIONS.map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </select>

        {/* Kind Filter */}
        <select
          value={currentKind}
          onChange={(e) => updateParams({ kind: e.target.value || null })}
          className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        >
          <option value="">{t('allKinds')}</option>
          {KIND_OPTIONS.map((k) => (
            <option key={k} value={k}>
              {tKinds(k)}
            </option>
          ))}
        </select>

        {/* Start Date */}
        <div className="flex items-center gap-1">
          <label className="text-xs text-gray-500">{t('startDate')}</label>
          <input
            type="date"
            value={currentStartDate}
            onChange={(e) => updateParams({ startDate: e.target.value || null })}
            className="rounded-md border border-gray-300 px-2 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>

        {/* End Date */}
        <div className="flex items-center gap-1">
          <label className="text-xs text-gray-500">{t('endDate')}</label>
          <input
            type="date"
            value={currentEndDate}
            onChange={(e) => updateParams({ endDate: e.target.value || null })}
            className="rounded-md border border-gray-300 px-2 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>
      </div>
    </div>
  );
}
