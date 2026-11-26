'use client';

import { useTranslations } from 'next-intl';
import { useRouter, useSearchParams } from 'next/navigation';
import { useState, useTransition, useCallback } from 'react';
import { Calendar, Search, X } from 'lucide-react';
import { CmxButton, CmxInput, CmxSelect, Label } from '@ui/primitives';
import { shiftCivilDate } from '@/lib/utils/operational-time';
import { useReportsClock } from '@features/reports/ui/reports-clock';

const DATE_PRESETS = ['today', '7d', '30d', '90d', 'custom'] as const;
type DatePreset = typeof DATE_PRESETS[number];

interface ReportFiltersBarProps {
  basePath: string;
  showStatusFilter?: boolean;
  statusOptions?: string[];
  showOrderTypeFilter?: boolean;
  showPaymentMethodFilter?: boolean;
}

function getPresetDates(preset: DatePreset, today: string): { startDate: string; endDate: string } | null {
  if (!today) return null;
  const daysBack = preset === 'today' ? 0 : preset === '7d' ? 7 : preset === '30d' ? 30 : preset === '90d' ? 90 : null;
  if (daysBack == null) return null;
  return { startDate: daysBack === 0 ? today : shiftCivilDate(today, -daysBack), endDate: today };
}

/**
 *
 * @param root0
 * @param root0.basePath
 * @param root0.showStatusFilter
 * @param root0.statusOptions
 * @param root0.showOrderTypeFilter
 * @param root0.showPaymentMethodFilter
 */
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
  const { today } = useReportsClock();
  const [isPending, startTransition] = useTransition();

  const currentStartDate = searchParams.get('startDate') || (today ? shiftCivilDate(today, -30) : '');
  const currentEndDate = searchParams.get('endDate') || today;
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
    const dates = getPresetDates(preset, today);
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
    const defaults = getPresetDates('30d', today);
    setStartDate(defaults?.startDate ?? '');
    setEndDate(defaults?.endDate ?? '');
    startTransition(() => {
      router.push(basePath);
    });
  };

  const hasFilters = searchParams.toString() !== '';

  return (
    <div className="space-y-3 rounded-lg border border-border bg-card p-4">
      {/* Date Presets */}
      <div className="flex flex-wrap items-center gap-2">
        <Calendar className="h-4 w-4 text-muted-foreground" />
        {DATE_PRESETS.map((preset) => (
          <CmxButton
            key={preset}
            type="button"
            size="sm"
            variant={currentPreset === preset ? 'primary' : 'outline'}
            onClick={() => handlePresetChange(preset)}
            disabled={isPending}
          >
            {t(preset)}
          </CmxButton>
        ))}
      </div>

      {/* Custom Date Range + Filters */}
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex items-center gap-1">
          <Label htmlFor="report-filter-start-date" className="text-xs text-muted-foreground">{tCommon('dateFrom')}</Label>
          <CmxInput
            id="report-filter-start-date"
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="w-auto"
          />
        </div>
        <div className="flex items-center gap-1">
          <Label htmlFor="report-filter-end-date" className="text-xs text-muted-foreground">{tCommon('dateTo')}</Label>
          <CmxInput
            id="report-filter-end-date"
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="w-auto"
          />
        </div>
        {currentPreset === 'custom' && (
          <CmxButton
            type="button"
            size="sm"
            variant="primary"
            onClick={handleCustomDateApply}
            disabled={isPending}
          >
            {t('apply')}
          </CmxButton>
        )}

        {showStatusFilter && statusOptions.length > 0 && (
          <CmxSelect
            value={currentStatus}
            onChange={(e) => updateParams({ status: e.target.value || null })}
            className="min-w-[10rem]"
            options={[
              { value: '', label: t('allStatuses') },
              ...statusOptions.map((s) => ({ value: s, label: s })),
            ]}
          />
        )}

        {hasFilters && (
          <CmxButton
            type="button"
            size="sm"
            variant="outline"
            onClick={handleClearFilters}
            disabled={isPending}
          >
            <X className="h-3 w-3 me-1" />
            {tCommon('clearFilters')}
          </CmxButton>
        )}
      </div>
    </div>
  );
}
