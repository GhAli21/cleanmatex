/**
 * Processing Filters Bar Component
 * Focus chips and compact Cmx filter toolbar wired to server-side worklist params.
 */

'use client';

import { useMemo } from 'react';
import { useTranslations } from 'next-intl';
import { RotateCcw, Search } from 'lucide-react';
import { CmxButton, CmxInput, CmxSelect } from '@ui/primitives';
import { PRIORITY_LEVELS } from '@/lib/constants/order-types';
import type { ProcessingFilters, ProcessingFocus } from '@/types/processing';

interface ProcessingFiltersBarProps {
  filters: ProcessingFilters;
  searchValue: string;
  onSearchChange: (value: string) => void;
  onFilterChange: (filters: ProcessingFilters) => void;
  onResetFilters: () => void;
  hasActiveFilters: boolean;
}

const FOCUS_KEYS: ProcessingFocus[] = ['all', 'urgent', 'overdue', 'issues', 'ready'];
const PROCESSING_SUB_STATUS_KEYS = [
  'processing',
  'sorting',
  'pretreatment',
  'washing',
  'drying',
  'finishing',
  'in_wash',
  'in_dry',
  'in_finish',
] as const;

/**
 * Compact filter bar with operational focus chips and server-backed controls.
 * @param props Filter state and callbacks.
 */
export function ProcessingFiltersBar(props: ProcessingFiltersBarProps) {
  const {
    filters,
    searchValue,
    onSearchChange,
    onFilterChange,
    onResetFilters,
    hasActiveFilters,
  } = props;
  const t = useTranslations('processing.filters');
  const tFocus = useTranslations('processing.focus');
  const tStatus = useTranslations('processing.status');
  const tCommon = useTranslations('common');

  const activeFocus: ProcessingFocus = filters.focus ?? 'all';

  const statusOptions = useMemo(
    () => [
      { value: '', label: tFocus('all') },
      ...PROCESSING_SUB_STATUS_KEYS.map((code) => ({
        value: code,
        label: tStatus(code),
      })),
    ],
    [tFocus, tStatus]
  );

  const priorityOptions = useMemo(
    () => [
      { value: '', label: t('allTypes') },
      { value: PRIORITY_LEVELS.NORMAL, label: t('normal') },
      { value: PRIORITY_LEVELS.EXPRESS, label: t('express') },
      { value: PRIORITY_LEVELS.URGENT, label: t('urgent') },
    ],
    [t]
  );

  const handleFieldChange = <K extends keyof ProcessingFilters>(
    key: K,
    value: ProcessingFilters[K]
  ) => {
    onFilterChange({ ...filters, [key]: value });
  };

  return (
    <div className="space-y-3 rounded-lg border border-border bg-card p-3">
      {/* Quick Focus Chips */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label={t('filterStatus')}>
          {FOCUS_KEYS.map((focusKey) => {
            const isActive = activeFocus === focusKey;
            return (
              <CmxButton
                key={focusKey}
                type="button"
                size="sm"
                variant={isActive ? 'primary' : 'outline'}
                onClick={() => handleFieldChange('focus', focusKey)}
                aria-pressed={isActive}
              >
                {tFocus(focusKey)}
              </CmxButton>
            );
          })}
        </div>

        {hasActiveFilters && (
          <CmxButton
            type="button"
            size="sm"
            variant="ghost"
            onClick={onResetFilters}
          >
            <RotateCcw className="me-1.5 h-3.5 w-3.5" aria-hidden />
            {t('clearFilters')}
          </CmxButton>
        )}
      </div>

      {/* Compact Toolbar */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <CmxInput
          type="search"
          label={tCommon('search')}
          placeholder={tCommon('quickSearch')}
          value={searchValue}
          onChange={(e) => onSearchChange(e.target.value)}
          leftIcon={<Search className="h-4 w-4" aria-hidden />}
          aria-label={tCommon('search')}
        />

        <CmxSelect
          label={t('orderType')}
          value={filters.priority || ''}
          onChange={(e) => handleFieldChange('priority', e.target.value || undefined)}
          options={priorityOptions}
        />

        <CmxInput
          type="date"
          label={t('date')}
          value={filters.readyByDate || ''}
          onChange={(e) => handleFieldChange('readyByDate', e.target.value || undefined)}
        />

        <CmxSelect
          label={t('filterStatus')}
          value={filters.statusFilter || ''}
          onChange={(e) => handleFieldChange('statusFilter', e.target.value || undefined)}
          options={statusOptions}
        />
      </div>
    </div>
  );
}
