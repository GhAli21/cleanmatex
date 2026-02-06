'use client';

import { useTranslations } from 'next-intl';
import { useRouter, useSearchParams } from 'next/navigation';
import { useState, useTransition, useCallback } from 'react';
import { Calendar, Search, X } from 'lucide-react';
import { format, subDays, startOfDay, endOfDay } from 'date-fns';

const DATE_PRESETS = ['today', '7d', '30d', '90d', 'custom'] as const;
type DatePreset = typeof DATE_PRESETS[number];

interface ReportFiltersBarProps {
  basePath: string;
  showStatusFilter?: boolean;
  statusOptions?: string[];
  showOrderTypeFilter?: boolean;
  showPaymentMethodFilter?: boolean;
}

function getPresetDates(preset: DatePreset): { startDate: string; endDate: string } | null {
  const now = new Date();
  const end = format(endOfDay(now), 'yyyy-MM-dd');
  switch (preset) {
    case 'today':
      return { startDate: format(startOfDay(now), 'yyyy-MM-dd'), endDate: end };
    case '7d':
      return { startDate: format(subDays(now, 7), 'yyyy-MM-dd'), endDate: end };
    case '30d':
      return { startDate: format(subDays(now, 30), 'yyyy-MM-dd'), endDate: end };
    case '90d':
      return { startDate: format(subDays(now, 90), 'yyyy-MM-dd'), endDate: end };
    default:
      return null;
  }
}

export default function ReportFiltersBar({
  basePath,
  showStatusFilter = false,
  statusOptions = [],
  showOrderTypeFilter = false,
  showPaymentMethodFilter = false,
}: ReportFiltersBarProps) {
  const t = useTranslations('reports.filters');
  const tCommon = useTranslations('common');
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const currentStartDate = searchParams.get('startDate') || format(subDays(new Date(), 30), 'yyyy-MM-dd');
  const currentEndDate = searchParams.get('endDate') || format(new Date(), 'yyyy-MM-dd');
  const currentStatus = searchParams.get('status') || '';
  const currentPreset = searchParams.get('preset') || '30d';

  const [startDate, setStartDate] = useState(currentStartDate);
  const [endDate, setEndDate] = useState(currentEndDate);

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
        router.push(`${basePath}?${params.toString()}`);
      });
    },
    [searchParams, router, basePath],
  );

  const handlePresetChange = (preset: DatePreset) => {
    const dates = getPresetDates(preset);
    if (dates) {
      setStartDate(dates.startDate);
      setEndDate(dates.endDate);
      updateParams({
        preset,
        startDate: dates.startDate,
        endDate: dates.endDate,
      });
    } else {
      updateParams({ preset });
    }
  };

  const handleCustomDateApply = () => {
    updateParams({
      preset: 'custom',
      startDate,
      endDate,
    });
  };

  const handleClearFilters = () => {
    const defaults = getPresetDates('30d')!;
    setStartDate(defaults.startDate);
    setEndDate(defaults.endDate);
    startTransition(() => {
      router.push(basePath);
    });
  };

  const hasFilters = searchParams.toString() !== '';

  return (
    <div className="space-y-3 rounded-lg border border-gray-200 bg-white p-4">
      {/* Date Presets */}
      <div className="flex flex-wrap items-center gap-2">
        <Calendar className="h-4 w-4 text-gray-500" />
        {DATE_PRESETS.map((preset) => (
          <button
            key={preset}
            onClick={() => handlePresetChange(preset)}
            disabled={isPending}
            className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
              currentPreset === preset
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            } disabled:opacity-50`}
          >
            {t(preset)}
          </button>
        ))}
      </div>

      {/* Custom Date Range + Filters */}
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex items-center gap-1">
          <label className="text-xs text-gray-500">{tCommon('dateFrom')}</label>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="rounded-md border border-gray-300 px-2 py-1.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>
        <div className="flex items-center gap-1">
          <label className="text-xs text-gray-500">{tCommon('dateTo')}</label>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="rounded-md border border-gray-300 px-2 py-1.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>
        {currentPreset === 'custom' && (
          <button
            onClick={handleCustomDateApply}
            disabled={isPending}
            className="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {t('apply')}
          </button>
        )}

        {showStatusFilter && statusOptions.length > 0 && (
          <select
            value={currentStatus}
            onChange={(e) => updateParams({ status: e.target.value || null })}
            className="rounded-md border border-gray-300 px-3 py-1.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            <option value="">{t('allStatuses')}</option>
            {statusOptions.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        )}

        {hasFilters && (
          <button
            onClick={handleClearFilters}
            disabled={isPending}
            className="flex items-center gap-1 rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            <X className="h-3 w-3" />
            {tCommon('clearFilters')}
          </button>
        )}
      </div>
    </div>
  );
}
