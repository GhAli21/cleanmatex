/**
 * Processing Modal Filters Component
 *
 * Enhanced filter bar for the processing modal.
 * Supports search, step filter, status filter, and rejected items filter.
 */

'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/Input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select-dropdown';
import { Search, X, Filter } from 'lucide-react';
import { Button } from '@/components/ui/Button';
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
          <Input
            type="text"
            placeholder={t('searchPlaceholder') || tCommon('search') || 'Search items...'}
            value={localFilters.search}
            onChange={(e) => handleFilterChange('search', e.target.value)}
            className="pl-9 pr-9 h-10"
            aria-label={t('searchLabel') || 'Search items'}
          />
          {localFilters.search && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleFilterChange('search', '')}
              className="absolute right-1 top-1/2 transform -translate-y-1/2 h-7 w-7 p-0"
              aria-label={tCommon('clear') || 'Clear search'}
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>

        {/* Quick Filters */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Step Filter */}
          <Select
            value={localFilters.step}
            onValueChange={(value) => handleFilterChange('step', value)}
          >
            <SelectTrigger className="h-10 w-full sm:w-[140px]">
              <SelectValue placeholder={t('filterByStep') || 'All Steps'} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('allSteps') || 'All Steps'}</SelectItem>
              {PROCESSING_STEPS.map(step => (
                <SelectItem key={step} value={step}>
                  {t(`steps.${step}`)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Status Filter */}
          <Select
            value={localFilters.status}
            onValueChange={(value) => handleFilterChange('status', value)}
          >
            <SelectTrigger className="h-10 w-full sm:w-[140px]">
              <SelectValue placeholder={t('filterByStatus') || 'All Status'} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('allStatus') || 'All Status'}</SelectItem>
              <SelectItem value="ready">{t('ready') || 'Ready'}</SelectItem>
              <SelectItem value="not_ready">{t('notReady') || 'Not Ready'}</SelectItem>
            </SelectContent>
          </Select>

          {/* Rejected Filter */}
          {rejectEnabled && (
            <Checkbox
              checked={localFilters.showRejectedOnTop}
              onCheckedChange={(checked) => {
                handleFilterChange('showRejectedOnTop', checked);
                onToggleRejectedOnTop(checked as boolean);
              }}
              label={t('showRejectedOnTop') || 'Show Rejected'}
            />
          )}

          {/* Clear Filters Button */}
          {hasActiveFilters && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleClearFilters}
              className="h-10"
              aria-label={tCommon('clearFilters') || 'Clear all filters'}
            >
              <X className="h-4 w-4 mr-1" />
              {tCommon('clearFilters') || 'Clear'}
            </Button>
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
