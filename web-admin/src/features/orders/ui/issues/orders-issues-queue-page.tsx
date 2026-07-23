/**
 * Tenant-wide order issues queue — shared filters + columns.
 */

'use client';

import * as React from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocale, useTranslations } from 'next-intl';
import { CmxSpinner } from '@ui/primitives';
import { CmxEmptyState, CmxDataTable, CmxKpiStatCard } from '@ui/data-display';
import {
  CmxCard,
  CmxCardContent,
  CmxCardHeader,
  CmxCardTitle,
} from '@ui/primitives/cmx-card';
import { ORDER_ISSUE_STATUS } from '@/lib/constants/order-issues';
import { OrderIssueSolveDialog } from './order-issue-solve-dialog';
import { OrderIssuesFilterBar } from './order-issues-filter-bar';
import { buildOrderIssueTableColumns } from './order-issues-table-columns';
import type {
  OrderIssuesPriorityFilter,
  OrderIssuesQueueScopeFilter,
  OrderIssuesSortBy,
  OrderIssuesSortDir,
  OrderIssuesStatusFilter,
} from './order-issues-filter-types';
import {
  DEFAULT_ORDER_ISSUES_SORT_BY,
  DEFAULT_ORDER_ISSUES_SORT_DIR,
} from './order-issues-filter-types';
import { sortOrderIssueRows } from './order-issues-sort';
import type { OrderIssueTableRow } from './order-issue-table-types';

/**
 * Dashboard issues queue screen.
 */
export function OrdersIssuesQueuePage() {
  const t = useTranslations('orders.issues');
  const locale = useLocale();
  const queryClient = useQueryClient();
  const [status, setStatus] = React.useState<OrderIssuesStatusFilter>('open');
  const [scope, setScope] = React.useState<OrderIssuesQueueScopeFilter>('all');
  const [priority, setPriority] =
    React.useState<OrderIssuesPriorityFilter>('all');
  const [sortBy, setSortBy] = React.useState<OrderIssuesSortBy>(
    DEFAULT_ORDER_ISSUES_SORT_BY
  );
  const [sortDir, setSortDir] = React.useState<OrderIssuesSortDir>(
    DEFAULT_ORDER_ISSUES_SORT_DIR
  );
  const [solveTarget, setSolveTarget] =
    React.useState<OrderIssueTableRow | null>(null);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['tenant-order-issues', status, scope, priority],
    queryFn: async () => {
      const params = new URLSearchParams({ status, scope });
      if (priority !== 'all') params.set('priority', priority);
      const response = await fetch(
        `/api/v1/orders/issues?${params.toString()}`
      );
      const json = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(
          (json as { error?: string }).error || t('listFailed')
        );
      }
      return ((json as { data?: OrderIssueTableRow[] }).data ??
        []) as OrderIssueTableRow[];
    },
  });

  const issues = React.useMemo(
    () => sortOrderIssueRows(data ?? [], sortBy, sortDir),
    [data, sortBy, sortDir]
  );
  const openInView = issues.filter(
    (row) => row.status === ORDER_ISSUE_STATUS.OPEN
  ).length;

  const columns = React.useMemo(
    () =>
      buildOrderIssueTableColumns({
        locale,
        t: (key, values) => t(key as never, values as never),
        includeOrderColumn: true,
        includeScopeColumn: true,
        onSolve: (row) => setSolveTarget(row),
      }),
    [locale, t]
  );

  return (
    <div className="space-y-4 p-4 md:p-6">
      <div>
        <h1 className="text-2xl font-semibold">{t('pageTitle')}</h1>
        <p className="text-sm text-muted-foreground">{t('pageDescription')}</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <CmxKpiStatCard
          title={t('filterOpen')}
          value={openInView}
        />
        <CmxKpiStatCard
          title={t('listTitle')}
          value={issues.length}
        />
      </div>

      <OrderIssuesFilterBar
        variant="queue"
        status={status}
        onStatusChange={setStatus}
        scope={scope}
        onScopeChange={(value) =>
          setScope(value as OrderIssuesQueueScopeFilter)
        }
        priority={priority}
        onPriorityChange={setPriority}
        sortBy={sortBy}
        sortDir={sortDir}
        onSortByChange={setSortBy}
        onSortDirChange={setSortDir}
        onReset={() => {
          setStatus('open');
          setScope('all');
          setPriority('all');
          setSortBy(DEFAULT_ORDER_ISSUES_SORT_BY);
          setSortDir(DEFAULT_ORDER_ISSUES_SORT_DIR);
        }}
        openCount={openInView}
        totalCount={issues.length}
      />

      <CmxCard>
        <CmxCardHeader>
          <CmxCardTitle>{t('listTitle')}</CmxCardTitle>
        </CmxCardHeader>
        <CmxCardContent>
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
        </CmxCardContent>
      </CmxCard>

      {solveTarget ? (
        <OrderIssueSolveDialog
          open={Boolean(solveTarget)}
          orderId={solveTarget.order_id!}
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
          onSuccess={() => {
            void refetch();
            void queryClient.invalidateQueries({
              queryKey: ['tenant-order-issues'],
            });
          }}
        />
      ) : null}
    </div>
  );
}
