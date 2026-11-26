/**
 * WorkflowQueueShell — shared operational queue frame for floor workflow screens
 * (Assembly, Quality Check, Packing, Home Collection).
 *
 * Built strictly on Cmx primitives/patterns: CmxCrudPageShell, CmxKpiStatCard,
 * CmxCodeSearchInput, CmxStatusBadge, CmxSummaryMessage, CmxEmptyState, CmxPagination.
 */

'use client';

import type { ReactNode } from 'react';
import { ArrowDown, ArrowUp, RefreshCw, RotateCcw } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { CmxCrudPageShell } from '@ui/patterns/cmx-crud-page-shell';
import { CmxEmptyState, CmxKpiStatCard, type CmxKpiStatCardTone } from '@ui/data-display';
import { CMX_PAGE_SIZE_OPTIONS } from '@ui/data-display/cmx-table-defaults';
import { CmxStatusBadge, CmxSummaryMessage, type CmxBadgeTone } from '@ui/feedback';
import { CmxCodeSearchInput, type CodeSearchSubmit } from '@ui/forms/cmx-code-search-input';
import { CmxPagination } from '@ui/navigation';
import { CmxButton, CmxSelect, CmxSkeleton, CmxSkeletonTable } from '@ui/primitives';
import { cn } from '@/lib/utils';
import { civilDateInZone, formatInstantOrEmpty } from '@/lib/utils/operational-time';

export interface WorkflowQueueKpi {
  key: string;
  title: string;
  value: string | number;
  icon?: ReactNode;
  tone?: CmxKpiStatCardTone;
  active?: boolean;
  onClick?: () => void;
}

export interface WorkflowQueueFocusOption {
  key: string;
  label: string;
  count?: number;
}

export interface WorkflowQueueSortOption {
  value: string;
  label: string;
}

export interface WorkflowQueuePagination {
  page: number;
  totalPages: number;
  limit: number;
  total: number;
}

export interface WorkflowQueueShellProps {
  title: string;
  subtitle: string;
  totalCount?: number;
  extraActions?: ReactNode;
  kpis?: WorkflowQueueKpi[];
  kpisLoading?: boolean;
  focusOptions: WorkflowQueueFocusOption[];
  activeFocus: string;
  onFocusChange: (focusKey: string) => void;
  searchValue: string;
  onSearchChange: (value: string) => void;
  onSearchSubmit: (submit: CodeSearchSubmit) => void;
  searchPlaceholder?: string;
  searchBusy?: boolean;
  sortOptions: WorkflowQueueSortOption[];
  sortBy: string;
  onSortByChange: (value: string) => void;
  sortOrder: 'asc' | 'desc';
  onSortOrderToggle: () => void;
  hasActiveFilters: boolean;
  onResetFilters: () => void;
  onRefresh: () => void | Promise<void>;
  isLoading: boolean;
  isFetching: boolean;
  error: string | null;
  isEmpty: boolean;
  emptyTitle: string;
  skeletonVariant?: 'cards' | 'table';
  pagination: WorkflowQueuePagination;
  pageSize: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
  children: ReactNode;
}

export type QueueSlaState = 'overdue' | 'dueSoon' | 'today' | null;

/**
 * SLA urgency from the promised Ready By instant.
 * Overdue and due-soon compare instants. "Today" is the civil day in the fulfilment branch zone.
 */
export function getQueueSlaState(
  readyByAt?: string | null,
  nowMs: number = Date.now(),
  zone?: string | null,
): QueueSlaState {
  if (!readyByAt) return null;
  const due = new Date(readyByAt);
  if (Number.isNaN(due.getTime())) return null;
  const diffMs = due.getTime() - nowMs;
  if (diffMs < 0) return 'overdue';
  if (diffMs <= 2 * 60 * 60 * 1000) return 'dueSoon';
  const dueDay = civilDateInZone(readyByAt, zone);
  const today = civilDateInZone(new Date(nowMs), zone);
  if (dueDay && dueDay === today) return 'today';
  return null;
}

/** Formats a Ready By instant in the fulfilment branch zone. A missing zone shows no clock. */
export function formatQueueDateTime(
  value: string | null | undefined,
  locale: string,
  zone?: string | null,
): string | null {
  const label = formatInstantOrEmpty(value, zone, locale === 'ar' ? 'ar' : 'en');
  return label || null;
}

/** Shared SLA + Priority + Issue badges for workflow queue cards and rows. */
export function WorkflowQueueOrderBadges({
  readyByAt,
  priority,
  hasIssue,
  hasStain,
  hasDamage,
  nowMs,
  opsZone,
}: {
  readyByAt?: string | null;
  priority?: string | null;
  hasIssue?: boolean;
  hasStain?: boolean;
  hasDamage?: boolean;
  nowMs: number;
  opsZone?: string | null;
}) {
  const tTable = useTranslations('processing.table');
  const slaState = getQueueSlaState(readyByAt, nowMs, opsZone);
  const normalizedPriority = String(priority ?? '').trim().toLowerCase();

  const priorityBadge: { label: string; tone: CmxBadgeTone } | null =
    normalizedPriority === 'urgent'
      ? { label: tTable('priorityUrgent'), tone: 'danger' }
      : normalizedPriority === 'express'
        ? { label: tTable('priorityExpress'), tone: 'brand' }
        : null;

  if (!slaState && !priorityBadge && !hasIssue && !hasStain && !hasDamage) {
    return null;
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {slaState ? (
        <CmxStatusBadge
          size="sm"
          tone={slaState === 'overdue' ? 'danger' : slaState === 'dueSoon' ? 'warning' : 'info'}
          label={
            slaState === 'overdue'
              ? tTable('slaOverdue')
              : slaState === 'dueSoon'
                ? tTable('slaDueSoon')
                : tTable('slaToday')
          }
        />
      ) : null}
      {priorityBadge ? (
        <CmxStatusBadge size="sm" tone={priorityBadge.tone} label={priorityBadge.label} />
      ) : null}
      {hasStain ? (
        <CmxStatusBadge size="sm" tone="warning" label={tTable('stain')} />
      ) : null}
      {hasDamage ? (
        <CmxStatusBadge size="sm" tone="danger" label={tTable('damage')} />
      ) : null}
      {hasIssue ? (
        <CmxStatusBadge size="sm" tone="danger" label={tTable('issue') || tTable('damage')} />
      ) : null}
    </div>
  );
}

/**
 * Shared operational queue shell used across floor stations.
 */
export function WorkflowQueueShell({
  title,
  subtitle,
  totalCount,
  extraActions,
  kpis,
  kpisLoading = false,
  focusOptions,
  activeFocus,
  onFocusChange,
  searchValue,
  onSearchChange,
  onSearchSubmit,
  searchPlaceholder,
  searchBusy = false,
  sortOptions,
  sortBy,
  onSortByChange,
  sortOrder,
  onSortOrderToggle,
  hasActiveFilters,
  onResetFilters,
  onRefresh,
  isLoading,
  isFetching,
  error,
  isEmpty,
  emptyTitle,
  skeletonVariant = 'cards',
  pagination,
  pageSize,
  onPageChange,
  onPageSizeChange,
  children,
}: WorkflowQueueShellProps) {
  const tWorkflow = useTranslations('workflow');
  const tProcessingFilters = useTranslations('processing.filters');
  const tProcessingTable = useTranslations('processing.table');
  const tCommon = useTranslations('common');

  const kpiGridCols =
    kpis && kpis.length >= 5
      ? 'grid-cols-2 md:grid-cols-3 xl:grid-cols-5'
      : 'grid-cols-2 md:grid-cols-4';

  const kpiSection =
    kpis && kpis.length > 0 ? (
      <div className={cn('grid gap-3', kpiGridCols)}>
        {kpisLoading
          ? kpis.map((kpi) => <CmxSkeleton key={kpi.key} className="h-24 w-full" />)
          : kpis.map((kpi) => {
              const card = (
                <CmxKpiStatCard
                  title={kpi.title}
                  value={kpi.value}
                  icon={kpi.icon}
                  tone={kpi.tone}
                  className={cn(
                    kpi.onClick && 'transition-shadow hover:shadow-md',
                    kpi.active && 'ring-2 ring-ring',
                  )}
                />
              );
              if (!kpi.onClick) {
                return <div key={kpi.key}>{card}</div>;
              }
              return (
                <CmxButton
                  key={kpi.key}
                  type="button"
                  variant="ghost"
                  aria-pressed={Boolean(kpi.active)}
                  onClick={kpi.onClick}
                  className="block h-auto w-full rounded-lg p-0 text-start font-normal hover:bg-transparent"
                >
                  {card}
                </CmxButton>
              );
            })}
      </div>
    ) : undefined;

  const filtersSection = (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div
          className="flex flex-wrap items-center gap-1.5"
          role="group"
          aria-label={tWorkflow('preparation.list.sortBy')}
        >
          {focusOptions.map((option) => {
            const active = activeFocus === option.key;
            return (
              <CmxButton
                key={option.key}
                type="button"
                size="sm"
                variant={active ? 'primary' : 'outline'}
                aria-pressed={active}
                onClick={() => onFocusChange(option.key)}
              >
                <span>{option.label}</span>
                {typeof option.count === 'number' ? (
                  <span className="ms-1.5 tabular-nums opacity-80">({option.count})</span>
                ) : null}
              </CmxButton>
            );
          })}
        </div>

        {hasActiveFilters ? (
          <CmxButton
            type="button"
            size="sm"
            variant="ghost"
            onClick={onResetFilters}
          >
            <RotateCcw className="me-1.5 h-3.5 w-3.5" aria-hidden="true" />
            {tProcessingFilters('clearFilters')}
          </CmxButton>
        ) : null}
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="flex-1" aria-busy={searchBusy || undefined}>
          <CmxCodeSearchInput
            value={searchValue}
            onChange={onSearchChange}
            onSubmit={onSearchSubmit}
            placeholder={searchPlaceholder ?? tWorkflow('preparation.list.searchPlaceholder')}
            aria-label={searchPlaceholder ?? tWorkflow('preparation.list.searchPlaceholder')}
            disabled={searchBusy}
          />
        </div>

        <div className="flex items-center gap-2">
          <CmxSelect
            fullWidth={false}
            value={sortBy}
            onChange={(e) => onSortByChange(e.target.value)}
            aria-label={tWorkflow('preparation.list.sortBy')}
            options={sortOptions}
          />
          <CmxButton
            type="button"
            variant="outline"
            onClick={onSortOrderToggle}
            aria-label={
              sortOrder === 'asc'
                ? tWorkflow('preparation.list.sortAsc')
                : tWorkflow('preparation.list.sortDesc')
            }
          >
            {sortOrder === 'asc' ? (
              <ArrowUp className="me-1.5 h-4 w-4" aria-hidden="true" />
            ) : (
              <ArrowDown className="me-1.5 h-4 w-4" aria-hidden="true" />
            )}
            <span className="hidden sm:inline">
              {sortOrder === 'asc'
                ? tWorkflow('preparation.list.sortAsc')
                : tWorkflow('preparation.list.sortDesc')}
            </span>
          </CmxButton>
        </div>
      </div>
    </div>
  );

  return (
    <CmxCrudPageShell
      className="mx-auto max-w-7xl p-4 md:p-6"
      title={
        <span className="inline-flex flex-wrap items-center gap-2.5">
          <span>{title}</span>
          {typeof totalCount === 'number' ? (
            <span className="inline-flex items-center rounded-full border border-border bg-muted px-2.5 py-0.5 text-xs font-semibold tabular-nums text-foreground">
              {totalCount}
            </span>
          ) : null}
        </span>
      }
      subtitle={subtitle}
      actions={
        <>
          {extraActions}
          <CmxButton
            type="button"
            variant="outline"
            size="sm"
            loading={isFetching}
            onClick={() => void onRefresh()}
          >
            {!isFetching ? (
              <RefreshCw className="me-1.5 h-4 w-4" aria-hidden="true" />
            ) : null}
            {tCommon('refresh')}
          </CmxButton>
        </>
      }
      kpis={kpiSection}
      filters={filtersSection}
    >
      {error ? (
        <div className="space-y-2">
          <CmxSummaryMessage type="error" message={error} />
          <CmxButton type="button" variant="outline" size="sm" onClick={() => void onRefresh()}>
            {tCommon('retry')}
          </CmxButton>
        </div>
      ) : null}

      {isLoading ? (
        skeletonVariant === 'table' ? (
          <CmxSkeletonTable rows={6} columns={6} />
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            <CmxSkeleton className="h-48 w-full" />
            <CmxSkeleton className="h-48 w-full" />
            <CmxSkeleton className="h-48 w-full" />
          </div>
        )
      ) : isEmpty ? (
        <CmxEmptyState
          title={hasActiveFilters ? tProcessingTable('noOrdersFiltered') : emptyTitle}
          description={hasActiveFilters ? tProcessingTable('clearFiltersHint') : undefined}
          action={
            hasActiveFilters ? (
              <CmxButton type="button" variant="outline" size="sm" onClick={onResetFilters}>
                <RotateCcw className="me-1.5 h-4 w-4" aria-hidden="true" />
                {tProcessingFilters('clearFilters')}
              </CmxButton>
            ) : undefined
          }
        />
      ) : (
        <div className={cn(isFetching && 'opacity-80 transition-opacity')}>
          {children}
        </div>
      )}

      <CmxPagination
        currentPage={pagination.page}
        totalPages={Math.max(1, pagination.totalPages)}
        pageSize={pageSize}
        totalItems={pagination.total}
        pageSizeOptions={[...CMX_PAGE_SIZE_OPTIONS]}
        onPageChange={onPageChange}
        onPageSizeChange={onPageSizeChange}
        showPageSizeSelector
        showWhenSinglePage={pagination.total > 0}
        disabled={isLoading || isFetching}
        labels={{ noItems: emptyTitle }}
      />
    </CmxCrudPageShell>
  );
}
