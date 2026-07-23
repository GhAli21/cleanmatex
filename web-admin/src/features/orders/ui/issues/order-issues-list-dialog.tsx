/**
 * Lists issues for a scope in a CmxDataTable with shared filters/columns.
 */

'use client';

import * as React from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocale, useTranslations } from 'next-intl';
import {
  CmxDialog,
  CmxDialogContent,
  CmxDialogHeader,
  CmxDialogTitle,
  CmxDialogFooter,
  CmxDialogDescription,
} from '@ui/overlays';
import { CmxButton, CmxSpinner } from '@ui/primitives';
import { CmxDataTable, CmxEmptyState } from '@ui/data-display';
import { cn } from '@/lib/utils';
import { OrderIssueSolveDialog } from './order-issue-solve-dialog';
import { OrderIssueReportDialog } from './order-issue-report-dialog';
import { OrderIssuesFilterBar } from './order-issues-filter-bar';
import { buildOrderIssueTableColumns } from './order-issues-table-columns';
import type {
  OrderIssuesDialogScopeFilter,
  OrderIssuesSortBy,
  OrderIssuesSortDir,
  OrderIssuesStatusFilter,
} from './order-issues-filter-types';
import {
  DEFAULT_ORDER_ISSUES_SORT_BY,
  DEFAULT_ORDER_ISSUES_SORT_DIR,
} from './order-issues-filter-types';
import { sortOrderIssueRows } from './order-issues-sort';
import { type OrderIssueScope } from '@/lib/constants/order-issues';
import type { OrderIssueTableRow } from './order-issue-table-types';

export interface OrderIssuesListDialogProps {
  open: boolean;
  orderId: string;
  scopeLevel: OrderIssueScope;
  orderItemId?: string | null;
  orderItemPieceId?: string | null;
  onOpenChange: (open: boolean) => void;
  onChanged?: () => void;
}

/**
 * Scoped issues list with solve / add — table layout + filters.
 */
export function OrderIssuesListDialog({
  open,
  orderId,
  scopeLevel,
  orderItemId,
  orderItemPieceId,
  onOpenChange,
  onChanged,
}: OrderIssuesListDialogProps) {
  const t = useTranslations('orders.issues');
  const tCommon = useTranslations('common');
  const locale = useLocale();
  const queryClient = useQueryClient();
  const [solveTarget, setSolveTarget] = React.useState<OrderIssueTableRow | null>(
    null
  );
  const [reportOpen, setReportOpen] = React.useState(false);
  const [scopeFilter, setScopeFilter] =
    React.useState<OrderIssuesDialogScopeFilter>('this');
  const [statusFilter, setStatusFilter] =
    React.useState<OrderIssuesStatusFilter>('open');
  const [sortBy, setSortBy] = React.useState<OrderIssuesSortBy>(
    DEFAULT_ORDER_ISSUES_SORT_BY
  );
  const [sortDir, setSortDir] = React.useState<OrderIssuesSortDir>(
    DEFAULT_ORDER_ISSUES_SORT_DIR
  );

  React.useEffect(() => {
    if (open) {
      setScopeFilter('this');
      setStatusFilter('open');
      setSortBy(DEFAULT_ORDER_ISSUES_SORT_BY);
      setSortDir(DEFAULT_ORDER_ISSUES_SORT_DIR);
    }
  }, [open]);

  const queryKey = [
    'order-issues',
    orderId,
    scopeLevel,
    orderItemId,
    orderItemPieceId,
    scopeFilter,
    statusFilter,
  ] as const;

  const { data, isLoading, refetch } = useQuery({
    queryKey,
    enabled: open && Boolean(orderId),
    queryFn: async () => {
      const params = new URLSearchParams({
        status: statusFilter,
        scopeFilter,
      });
      if (scopeFilter === 'this') {
        params.set('includeChildren', 'false');
        if (orderItemPieceId) {
          params.set('orderItemPieceId', orderItemPieceId);
        } else if (orderItemId) {
          params.set('orderItemId', orderItemId);
        }
      }
      const response = await fetch(
        `/api/v1/orders/${orderId}/issues?${params.toString()}`
      );
      const json = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(
          (json as { error?: string }).error || t('listFailed')
        );
      }
      return {
        issues: ((json as { data?: OrderIssueTableRow[] }).data ??
          []) as OrderIssueTableRow[],
        openCount:
          (json as { meta?: { openCount?: number } }).meta?.openCount ?? 0,
        totalCount:
          (json as { meta?: { totalCount?: number } }).meta?.totalCount ?? 0,
      };
    },
  });

  const refresh = () => {
    void refetch();
    void queryClient.invalidateQueries({
      queryKey: ['order-issue-summary', orderId],
    });
    onChanged?.();
  };

  const issues = React.useMemo(
    () => sortOrderIssueRows(data?.issues ?? [], sortBy, sortDir),
    [data?.issues, sortBy, sortDir]
  );
  const showScopeCol = scopeFilter !== 'this';

  const headerScopeLabel = React.useMemo(() => {
    if (scopeFilter === 'this') {
      return t(
        `headerScopeBadge.this_${scopeLevel.toLowerCase()}` as
          | 'headerScopeBadge.this_order'
          | 'headerScopeBadge.this_item'
          | 'headerScopeBadge.this_piece'
      );
    }
    if (scopeFilter === 'all') return t('headerScopeBadge.all');
    return t(
      `headerScopeBadge.${scopeFilter}` as
        | 'headerScopeBadge.order'
        | 'headerScopeBadge.item'
        | 'headerScopeBadge.piece'
    );
  }, [scopeFilter, scopeLevel, t]);

  const columns = React.useMemo(
    () =>
      buildOrderIssueTableColumns({
        locale,
        t: (key, values) => t(key as never, values as never),
        includeScopeColumn: showScopeCol,
        onSolve: (row) => setSolveTarget(row),
      }),
    [locale, showScopeCol, t]
  );

  return (
    <>
      <CmxDialog
        open={open}
        onOpenChange={(next) => {
          if (solveTarget || reportOpen) return;
          onOpenChange(next);
        }}
      >
        <CmxDialogContent className="max-w-6xl w-[min(96vw,80rem)]">
          <CmxDialogHeader>
            <CmxDialogTitle>{t('listTitle')}</CmxDialogTitle>
            <CmxDialogDescription className="sr-only">
              {headerScopeLabel}
            </CmxDialogDescription>
            <div className="pt-1.5">
              <span
                className={cn(
                  'inline-flex items-center rounded-full border-2 border-transparent',
                  'bg-[rgb(var(--cmx-primary-rgb,14_165_233))] px-4 py-1.5',
                  'text-base font-semibold tracking-tight text-white shadow-sm'
                )}
              >
                {headerScopeLabel}
              </span>
            </div>
          </CmxDialogHeader>

          <OrderIssuesFilterBar
            variant="dialog"
            status={statusFilter}
            onStatusChange={setStatusFilter}
            scope={scopeFilter}
            onScopeChange={(value) =>
              setScopeFilter(value as OrderIssuesDialogScopeFilter)
            }
            sortBy={sortBy}
            sortDir={sortDir}
            onSortByChange={setSortBy}
            onSortDirChange={setSortDir}
            onReset={() => {
              setScopeFilter('this');
              setStatusFilter('open');
              setSortBy(DEFAULT_ORDER_ISSUES_SORT_BY);
              setSortDir(DEFAULT_ORDER_ISSUES_SORT_DIR);
            }}
            openCount={data?.openCount}
            totalCount={data?.totalCount}
            className="mb-3"
          />

          <div className="max-h-[60vh] overflow-auto py-2">
            {isLoading ? (
              <div className="flex justify-center py-10">
                <CmxSpinner />
              </div>
            ) : issues.length === 0 ? (
              <CmxEmptyState
                title={t('emptyTitle')}
                description={t('emptyDescription')}
              />
            ) : (
              <CmxDataTable
                columns={columns}
                data={issues}
                paginationFooter="never"
                emptyMessage={t('emptyTitle')}
              />
            )}
          </div>

          <CmxDialogFooter>
            <CmxButton
              type="button"
              variant="secondary"
              onClick={() => onOpenChange(false)}
            >
              {tCommon('close')}
            </CmxButton>
            <CmxButton
              type="button"
              variant="primary"
              onClick={() => setReportOpen(true)}
            >
              {t('addIssue')}
            </CmxButton>
          </CmxDialogFooter>
        </CmxDialogContent>
      </CmxDialog>

      {solveTarget ? (
        <OrderIssueSolveDialog
          open={Boolean(solveTarget)}
          orderId={orderId}
          issueId={solveTarget.id}
          issueSnippet={solveTarget.issue_text}
          issueTypeLabel={
            locale === 'ar'
              ? solveTarget.issue_type_name2 ||
                solveTarget.issue_type_name ||
                solveTarget.issue_code
              : solveTarget.issue_type_name || solveTarget.issue_code
          }
          onOpenChange={(next) => {
            if (!next) setSolveTarget(null);
          }}
          onSuccess={refresh}
        />
      ) : null}

      <OrderIssueReportDialog
        open={reportOpen}
        orderId={orderId}
        scopeLevel={scopeLevel}
        orderItemId={orderItemId}
        orderItemPieceId={orderItemPieceId}
        onOpenChange={setReportOpen}
        onSuccess={refresh}
      />
    </>
  );
}
