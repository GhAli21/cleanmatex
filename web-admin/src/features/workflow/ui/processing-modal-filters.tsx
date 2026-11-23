/**
 * Processing Modal Filters Component
 * Controlled toolbar with search, service category, dynamic step,
 * status/condition filters, rejected sort toggle, and expand/collapse all.
 */

'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import { ChevronsDownUp, ChevronsUpDown, RotateCcw, Search, X } from 'lucide-react';
import { CmxButton, CmxCheckbox, CmxInput, CmxSelect } from '@ui/primitives';
import type { ProcessingStep } from '@/types/order';

export type ProcessingModalStatusFilter =
  | 'all'
  | 'ready'
  | 'not_ready'
  | 'has_issues'
  | 'has_condition'
  | 'rejected';

export interface ProcessingModalFiltersState {
  search: string;
  category: string;
  step: ProcessingStep | 'all';
  status: ProcessingModalStatusFilter;
  showRejectedOnTop: boolean;
}

export interface ProcessingFilterOption {
  code: string;
  label: string;
}

interface ProcessingModalFiltersProps {
  filters: ProcessingModalFiltersState;
  onFiltersChange: (filters: ProcessingModalFiltersState) => void;
  categories?: ProcessingFilterOption[];
  stepOptions?: ProcessingFilterOption[];
  rejectEnabled: boolean;
  allExpanded?: boolean;
  onToggleExpandAll?: () => void;
  showExpandAll?: boolean;
}

const FALLBACK_STEP_CODES: ProcessingStep[] = [
  'sorting',
  'pretreatment',
  'washing',
  'drying',
  'finishing',
];

/**
 * Filter and bulk-view toolbar inside `ProcessingModal`.
 * @param props Filter state, dynamic category/step options, and expand-all handler.
 */
export function ProcessingModalFilters(props: ProcessingModalFiltersProps) {
  const {
    filters,
    onFiltersChange,
    categories = [],
    stepOptions = [],
    rejectEnabled,
    allExpanded = false,
    onToggleExpandAll,
    showExpandAll = false,
  } = props;
  const t = useTranslations('processing.modal');
  const tSteps = useTranslations('processing.steps');
  const tCommon = useTranslations('common');

  const resolvedStepOptions = React.useMemo(() => {
    if (stepOptions.length > 0) return stepOptions;
    return FALLBACK_STEP_CODES.map((code) => ({
      code,
      label: tSteps(code as 'sorting' | 'pretreatment' | 'washing' | 'drying' | 'finishing'),
    }));
  }, [stepOptions, tSteps]);

  const categorySelectOptions = React.useMemo(
    () => [
      { value: 'all', label: t('allCategories') },
      ...categories.map((cat) => ({ value: cat.code, label: cat.label })),
    ],
    [categories, t]
  );

  const stepSelectOptions = React.useMemo(
    () => [
      { value: 'all', label: t('allSteps') },
      ...resolvedStepOptions.map((step) => ({ value: step.code, label: step.label })),
    ],
    [resolvedStepOptions, t]
  );

  const statusSelectOptions = React.useMemo(() => {
    const base = [
      { value: 'all', label: t('allStatus') },
      { value: 'ready', label: t('ready') },
      { value: 'not_ready', label: t('notReady') },
      { value: 'has_issues', label: t('hasIssues') },
      { value: 'has_condition', label: t('hasCondition') },
    ];
    if (rejectEnabled) {
      base.push({ value: 'rejected', label: t('rejectedOnly') });
    }
    return base;
  }, [rejectEnabled, t]);

  const updateField = <K extends keyof ProcessingModalFiltersState>(
    key: K,
    value: ProcessingModalFiltersState[K]
  ) => {
    onFiltersChange({ ...filters, [key]: value });
  };

  const handleClearFilters = () => {
    onFiltersChange({
      search: '',
      category: 'all',
      step: 'all',
      status: 'all',
      showRejectedOnTop: false,
    });
  };

  const hasActiveFilters = Boolean(
    filters.search ||
      filters.category !== 'all' ||
      filters.step !== 'all' ||
      filters.status !== 'all' ||
      filters.showRejectedOnTop
  );

  return (
    <div
      className="space-y-2 rounded-lg border border-border bg-muted/40 p-2.5"
      role="search"
      aria-label={t('searchLabel')}
    >
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-12">
        <div className={categories.length > 0 ? 'lg:col-span-4' : 'lg:col-span-6'}>
          <CmxInput
            type="search"
            placeholder={t('searchPlaceholder')}
            value={filters.search}
            onChange={(e) => updateField('search', e.target.value)}
            leftIcon={<Search className="h-4 w-4" aria-hidden />}
            trailing={
              filters.search ? (
                <CmxButton
                  type="button"
                  variant="ghost"
                  size="xs"
                  onClick={() => updateField('search', '')}
                  aria-label={tCommon('clear')}
                  className="h-6 w-6 p-0"
                >
                  <X className="h-3.5 w-3.5" aria-hidden />
                </CmxButton>
              ) : undefined
            }
            aria-label={t('searchLabel')}
            className="h-9 text-xs sm:text-sm"
          />
        </div>

        {categories.length > 0 && (
          <div className="lg:col-span-3">
            <CmxSelect
              size="sm"
              value={filters.category}
              onChange={(e) => updateField('category', e.target.value)}
              options={categorySelectOptions}
              aria-label={t('filterByCategory')}
            />
          </div>
        )}

        <div className={categories.length > 0 ? 'lg:col-span-2' : 'lg:col-span-3'}>
          <CmxSelect
            size="sm"
            value={filters.step}
            onChange={(e) => updateField('step', e.target.value as ProcessingStep | 'all')}
            options={stepSelectOptions}
            aria-label={t('filterByStep')}
          />
        </div>

        <div className="lg:col-span-3">
          <CmxSelect
            size="sm"
            value={filters.status}
            onChange={(e) => updateField('status', e.target.value as ProcessingModalStatusFilter)}
            options={statusSelectOptions}
            aria-label={t('filterByStatus')}
          />
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-3">
          {rejectEnabled && (
            <CmxCheckbox
              checked={filters.showRejectedOnTop}
              onChange={(e) => updateField('showRejectedOnTop', e.target.checked)}
              label={t('showRejectedOnTop')}
            />
          )}

          {hasActiveFilters && (
            <CmxButton type="button" variant="ghost" size="xs" onClick={handleClearFilters}>
              <RotateCcw className="me-1 h-3 w-3" aria-hidden />
              {t('clearFilters')}
            </CmxButton>
          )}
        </div>

        {showExpandAll && onToggleExpandAll && (
          <CmxButton type="button" variant="outline" size="xs" onClick={onToggleExpandAll}>
            {allExpanded ? (
              <>
                <ChevronsDownUp className="me-1 h-3.5 w-3.5" aria-hidden />
                {t('collapseAll')}
              </>
            ) : (
              <>
                <ChevronsUpDown className="me-1 h-3.5 w-3.5" aria-hidden />
                {t('expandAll')}
              </>
            )}
          </CmxButton>
        )}
      </div>
    </div>
  );
}
