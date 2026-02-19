/**
 * Processing Modal Filters Component
 *
 * Enhanced filter bar for the processing modal.
 * Supports search, step filter, status filter, and rejected items filter.
 */

'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import { CmxCheckbox, CmxInput } from '@ui/primitives';
import {
  CmxSelectDropdown,
  CmxSelectDropdownContent,
  CmxSelectDropdownItem,
  CmxSelectDropdownTrigger,
  CmxSelectDropdownValue,
} from '@ui/forms';
import { Search, X, Filter } from 'lucide-react';
import { CmxButton } from '@ui/primitives';
import type { ProcessingStep } from '@/types/order';

export interface ProcessingModalFiltersState {
  search: string;
  step: ProcessingStep | 'all';
  status: 'all' | 'ready' | 'not_ready';
  showRejectedOnTop: boolean;
}

interface ProcessingModalFiltersProps {
  showRejectedOnTop: boolean;
  onToggleRejectedOnTop: (value: boolean) => void;
  filters?: ProcessingModalFiltersState;
  onFiltersChange?: (filters: ProcessingModalFiltersState) => void;
  rejectEnabled: boolean;
}

const PROCESSING_STEPS: ProcessingStep[] = [
  'sorting',
  'pretreatment',
  'washing',
  'drying',
  'finishing',
];

export function ProcessingModalFilters({
  showRejectedOnTop,
  onToggleRejectedOnTop,
  filters,
  onFiltersChange,
  rejectEnabled,
}: ProcessingModalFiltersProps) {
  const t = useTranslations('processing.modal');
  const tCommon = useTranslations('common');

  const [localFilters, setLocalFilters] = React.useState<ProcessingModalFiltersState>({
    search: filters?.search || '',
    step: filters?.step || 'all',
    status: filters?.status || 'all',
    showRejectedOnTop,
  });

  const [isExpanded, setIsExpanded] = React.useState(false);

  React.useEffect(() => {
    setLocalFilters(prev => ({ ...prev, showRejectedOnTop }));
  }, [showRejectedOnTop]);

  const handleFilterChange = (key: keyof ProcessingModalFiltersState, value: any) => {
    const newFilters = { ...localFilters, [key]: value };
    setLocalFilters(newFilters);
    onFiltersChange?.(newFilters);
  };

  const handleClearFilters = () => {
    const clearedFilters: ProcessingModalFiltersState = {
      search: '',
      step: 'all',
      status: 'all',
      showRejectedOnTop: false,
    };
    setLocalFilters(clearedFilters);
    onFiltersChange?.(clearedFilters);
    onToggleRejectedOnTop(false);
  };

  const hasActiveFilters = localFilters.search ||
    localFilters.step !== 'all' ||
    localFilters.status !== 'all' ||
    localFilters.showRejectedOnTop;

  return (
    <div className="space-y-3">
      {/* Main Filter Bar */}
      <div
        className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 p-3 bg-gray-50 rounded-lg border"
        role="search"
        aria-label="Filter items and pieces"
      >
        {/* Search Input */}
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
          <CmxInput
            type="text"
            placeholder={t('searchPlaceholder') || tCommon('search') || 'Search items...'}
            value={localFilters.search}
            onChange={(e) => handleFilterChange('search', e.target.value)}
            className="pl-9 pr-9 h-10"
            aria-label={t('searchLabel') || 'Search items'}
          />
          {localFilters.search && (
            <CmxButton
              variant="ghost"
              size="sm"
              onClick={() => handleFilterChange('search', '')}
              className="absolute right-1 top-1/2 transform -translate-y-1/2 h-7 w-7 p-0"
              aria-label={tCommon('clear') || 'Clear search'}
            >
              <X className="h-4 w-4" />
            </CmxButton>
          )}
        </div>

        {/* Quick Filters */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Step Filter */}
          <CmxSelectDropdown
            value={localFilters.step}
            onValueChange={(value) => handleFilterChange('step', value)}
          >
            <CmxSelectDropdownTrigger className="h-10 w-full sm:w-[140px]">
              <CmxSelectDropdownValue
                placeholder={t('filterByStep') || 'All Steps'}
                displayValue={localFilters.step === 'all' ? (t('allSteps') || 'All Steps') : t(`steps.${localFilters.step}`)}
              />
            </CmxSelectDropdownTrigger>
            <CmxSelectDropdownContent>
              <CmxSelectDropdownItem value="all">{t('allSteps') || 'All Steps'}</CmxSelectDropdownItem>
              {PROCESSING_STEPS.map(step => (
                <CmxSelectDropdownItem key={step} value={step}>
                  {t(`steps.${step}`)}
                </CmxSelectDropdownItem>
              ))}
            </CmxSelectDropdownContent>
          </CmxSelectDropdown>

          {/* Status Filter */}
          <CmxSelectDropdown
            value={localFilters.status}
            onValueChange={(value) => handleFilterChange('status', value)}
          >
            <CmxSelectDropdownTrigger className="h-10 w-full sm:w-[140px]">
              <CmxSelectDropdownValue
                placeholder={t('filterByStatus') || 'All Status'}
                displayValue={
                  localFilters.status === 'all'
                    ? (t('allStatus') || 'All Status')
                    : localFilters.status === 'ready'
                      ? t('ready')
                      : t('notReady')
                }
              />
            </CmxSelectDropdownTrigger>
            <CmxSelectDropdownContent>
              <CmxSelectDropdownItem value="all">{t('allStatus') || 'All Status'}</CmxSelectDropdownItem>
              <CmxSelectDropdownItem value="ready">{t('ready') || 'Ready'}</CmxSelectDropdownItem>
              <CmxSelectDropdownItem value="not_ready">{t('notReady') || 'Not Ready'}</CmxSelectDropdownItem>
            </CmxSelectDropdownContent>
          </CmxSelectDropdown>

          {/* Rejected Filter */}
          {rejectEnabled && (
            <CmxCheckbox
              checked={localFilters.showRejectedOnTop}
              onChange={(e) => {
                const checked = e.target.checked;
                handleFilterChange('showRejectedOnTop', checked);
                onToggleRejectedOnTop(checked);
              }}
              label={t('showRejectedOnTop') || 'Show Rejected'}
            />
          )}

          {/* Clear Filters Button */}
          {hasActiveFilters && (
            <CmxButton
              variant="ghost"
              size="sm"
              onClick={handleClearFilters}
              className="h-10"
              aria-label={tCommon('clearFilters') || 'Clear all filters'}
            >
              <X className="h-4 w-4 mr-1" />
              {tCommon('clearFilters') || 'Clear'}
            </CmxButton>
          )}
        </div>
      </div>

      {/* Active Filters Summary */}
      {hasActiveFilters && (
        <div className="flex items-center gap-2 flex-wrap text-sm">
          <Filter className="h-4 w-4 text-gray-500" />
          <span className="text-gray-600 font-medium">
            {t('activeFilters') || 'Active filters:'}
          </span>
          {localFilters.search && (
            <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded text-xs">
              {t('search') || 'Search'}: {localFilters.search}
            </span>
          )}
          {localFilters.step !== 'all' && (
            <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded text-xs">
              {t('step') || 'Step'}: {t(`steps.${localFilters.step}`)}
            </span>
          )}
          {localFilters.status !== 'all' && (
            <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded text-xs">
              {t('status') || 'Status'}: {localFilters.status === 'ready' ? t('ready') : t('notReady')}
            </span>
          )}
          {localFilters.showRejectedOnTop && (
            <span className="px-2 py-1 bg-red-100 text-red-800 rounded text-xs">
              {t('rejected') || 'Rejected'}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
