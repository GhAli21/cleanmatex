/**
 * Shared status / scope / priority / sort toolbar for issues tables.
 */

'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import { RotateCcw } from 'lucide-react';
import { CmxButton } from '@ui/primitives';
import {
  CmxSelectDropdown,
  CmxSelectDropdownTrigger,
  CmxSelectDropdownValue,
  CmxSelectDropdownContent,
  CmxSelectDropdownItem,
} from '@ui/forms';
import { cn } from '@/lib/utils';
import { ORDER_ISSUE_SCOPE, PRIORITY_CODES } from '@/lib/constants/order-issues';
import {
  DEFAULT_ORDER_ISSUES_SORT_BY,
  DEFAULT_ORDER_ISSUES_SORT_DIR,
  ORDER_ISSUES_SORT_DIR,
  ORDER_ISSUES_SORT_FIELDS_QUEUE,
  ORDER_ISSUES_SORT_FIELDS_SHARED,
  type OrderIssuesDialogScopeFilter,
  type OrderIssuesPriorityFilter,
  type OrderIssuesQueueScopeFilter,
  type OrderIssuesSortBy,
  type OrderIssuesSortDir,
  type OrderIssuesStatusFilter,
} from './order-issues-filter-types';

function SegmentedOption({
  active,
  label,
  onClick,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <CmxButton
      type="button"
      size="xs"
      variant="ghost"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        'h-7 rounded-md px-2.5 text-xs font-medium shadow-none',
        active
          ? 'bg-background text-foreground shadow-sm ring-1 ring-border'
          : 'text-muted-foreground hover:text-foreground'
      )}
    >
      {label}
    </CmxButton>
  );
}

function FilterGroup({
  label,
  ariaLabel,
  children,
}: {
  label: string;
  ariaLabel: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      <div
        role="group"
        aria-label={ariaLabel}
        className="inline-flex w-fit max-w-full flex-wrap items-center gap-0.5 rounded-lg border border-border/80 bg-muted/60 p-0.5"
      >
        {children}
      </div>
    </div>
  );
}

export interface OrderIssuesFilterBarProps {
  variant: 'dialog' | 'queue';
  status: OrderIssuesStatusFilter;
  onStatusChange: (value: OrderIssuesStatusFilter) => void;
  onReset: () => void;
  scope: OrderIssuesDialogScopeFilter | OrderIssuesQueueScopeFilter;
  onScopeChange: (
    value: OrderIssuesDialogScopeFilter | OrderIssuesQueueScopeFilter
  ) => void;
  priority?: OrderIssuesPriorityFilter;
  onPriorityChange?: (value: OrderIssuesPriorityFilter) => void;
  sortBy: OrderIssuesSortBy;
  sortDir: OrderIssuesSortDir;
  onSortByChange: (value: OrderIssuesSortBy) => void;
  onSortDirChange: (value: OrderIssuesSortDir) => void;
  openCount?: number;
  totalCount?: number;
  className?: string;
}

/**
 * Full-width filter toolbar with labeled segmented controls + sort.
 */
export function OrderIssuesFilterBar({
  variant,
  status,
  onStatusChange,
  onReset,
  scope,
  onScopeChange,
  priority = 'all',
  onPriorityChange,
  sortBy,
  sortDir,
  onSortByChange,
  onSortDirChange,
  openCount,
  totalCount,
  className,
}: OrderIssuesFilterBarProps) {
  const t = useTranslations('orders.issues');

  const dialogScopeChips: {
    key: OrderIssuesDialogScopeFilter;
    label: string;
  }[] = [
    { key: 'this', label: t('filterThisLevel') },
    { key: 'order', label: t('filterScope.order') },
    { key: 'item', label: t('filterScope.item') },
    { key: 'piece', label: t('filterScope.piece') },
    { key: 'all', label: t('filterScope.all') },
  ];

  const queueScopeChips: {
    key: OrderIssuesQueueScopeFilter;
    label: string;
  }[] = [
    { key: 'all', label: t('filterScope.all') },
    { key: ORDER_ISSUE_SCOPE.ORDER, label: t('filterScope.order') },
    { key: ORDER_ISSUE_SCOPE.ITEM, label: t('filterScope.item') },
    { key: ORDER_ISSUE_SCOPE.PIECE, label: t('filterScope.piece') },
  ];

  const sortFields =
    variant === 'queue'
      ? ORDER_ISSUES_SORT_FIELDS_QUEUE
      : ORDER_ISSUES_SORT_FIELDS_SHARED;

  const isDirty =
    (variant === 'dialog'
      ? status !== 'open' || scope !== 'this'
      : status !== 'open' || scope !== 'all' || priority !== 'all') ||
    sortBy !== DEFAULT_ORDER_ISSUES_SORT_BY ||
    sortDir !== DEFAULT_ORDER_ISSUES_SORT_DIR;

  return (
    <div
      className={cn(
        'rounded-xl border border-border bg-card/50 px-3 py-3 sm:px-4',
        className
      )}
      role="search"
      aria-label={t('filterToolbarAria')}
    >
      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
            <FilterGroup
              label={t('filterGroupStatus')}
              ariaLabel={t('filterGroupStatus')}
            >
              {(
                [
                  ['open', t('filterOpen')],
                  ['solved', t('filterSolved')],
                  ['all', t('filterAll')],
                ] as const
              ).map(([key, label]) => (
                <SegmentedOption
                  key={key}
                  active={status === key}
                  label={label}
                  onClick={() => onStatusChange(key)}
                />
              ))}
            </FilterGroup>

            <FilterGroup
              label={t('filterGroupLevel')}
              ariaLabel={t('filterGroupLevel')}
            >
              {variant === 'dialog'
                ? dialogScopeChips.map(({ key, label }) => (
                    <SegmentedOption
                      key={key}
                      active={scope === key}
                      label={label}
                      onClick={() => onScopeChange(key)}
                    />
                  ))
                : queueScopeChips.map(({ key, label }) => (
                    <SegmentedOption
                      key={key}
                      active={scope === key}
                      label={label}
                      onClick={() => onScopeChange(key)}
                    />
                  ))}
            </FilterGroup>

            {variant === 'queue' && onPriorityChange ? (
              <FilterGroup
                label={t('filterGroupPriority')}
                ariaLabel={t('filterGroupPriority')}
              >
                <SegmentedOption
                  active={priority === 'all'}
                  label={t('filterAll')}
                  onClick={() => onPriorityChange('all')}
                />
                {PRIORITY_CODES.map((code) => (
                  <SegmentedOption
                    key={code}
                    active={priority === code}
                    label={t(`priorities.${code}`)}
                    onClick={() => onPriorityChange(code)}
                  />
                ))}
              </FilterGroup>
            ) : null}
          </div>

          <div className="flex flex-wrap items-center gap-2 lg:shrink-0 lg:pb-0.5">
            {typeof openCount === 'number' && typeof totalCount === 'number' ? (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-muted/40 px-2.5 py-1 text-xs text-muted-foreground">
                <span className="font-medium text-foreground">{openCount}</span>
                {t('filterOpenCountShort')}
                <span className="text-border">·</span>
                <span className="font-medium text-foreground">{totalCount}</span>
                {t('filterTotalCountShort')}
              </span>
            ) : null}

            {isDirty ? (
              <CmxButton
                type="button"
                size="xs"
                variant="ghost"
                onClick={onReset}
                className="h-7 gap-1.5 text-xs text-muted-foreground"
              >
                <RotateCcw className="h-3.5 w-3.5" aria-hidden />
                {t('filterReset')}
              </CmxButton>
            ) : null}
          </div>
        </div>

        <div className="flex flex-col gap-1.5 border-t border-border/60 pt-3 sm:flex-row sm:flex-wrap sm:items-end sm:gap-3">
          <div className="flex min-w-[11rem] flex-col gap-1.5">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              {t('sortBy')}
            </span>
            <CmxSelectDropdown
              value={sortBy}
              onValueChange={(value) =>
                onSortByChange(value as OrderIssuesSortBy)
              }
            >
              <CmxSelectDropdownTrigger
                aria-label={t('sortBy')}
                className="h-8 w-[11.5rem]"
              >
                <CmxSelectDropdownValue />
              </CmxSelectDropdownTrigger>
              <CmxSelectDropdownContent>
                {sortFields.map((field) => (
                  <CmxSelectDropdownItem key={field} value={field}>
                    {t(`sortFields.${field}`)}
                  </CmxSelectDropdownItem>
                ))}
              </CmxSelectDropdownContent>
            </CmxSelectDropdown>
          </div>

          <div className="flex min-w-[8rem] flex-col gap-1.5">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              {t('sortDirection')}
            </span>
            <div
              role="group"
              aria-label={t('sortDirection')}
              className="inline-flex w-fit items-center gap-0.5 rounded-lg border border-border/80 bg-muted/60 p-0.5"
            >
              <SegmentedOption
                active={sortDir === ORDER_ISSUES_SORT_DIR.ASC}
                label={t('sortAsc')}
                onClick={() => onSortDirChange(ORDER_ISSUES_SORT_DIR.ASC)}
              />
              <SegmentedOption
                active={sortDir === ORDER_ISSUES_SORT_DIR.DESC}
                label={t('sortDesc')}
                onClick={() => onSortDirChange(ORDER_ISSUES_SORT_DIR.DESC)}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
