/**
 * Tenant-wide order issues queue — shared filters, search, pagination, photos & solve dialog.
 */

'use client';

import * as React from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocale, useTranslations } from 'next-intl';
import { RefreshCw, Search } from 'lucide-react';
import { CmxButton, CmxInput, CmxSkeleton, CmxSkeletonTable } from '@ui/primitives';
import { CmxEmptyState, CmxDataTable, CmxKpiStatCard } from '@ui/data-display';
import { CMX_DEFAULT_PAGE_SIZE } from '@ui/data-display/cmx-table-defaults';
import { CmxSummaryMessage } from '@ui/feedback';
import {
  CmxDialog,
  CmxDialogContent,
  CmxDialogDescription,
  CmxDialogFooter,
  CmxDialogHeader,
  CmxDialogTitle,
} from '@ui/overlays';
import {
  CmxCard,
  CmxCardContent,
  CmxCardHeader,
  CmxCardTitle,
} from '@ui/primitives/cmx-card';
import { FileAttachments } from '@features/file-util';
import { FILE_CATEGORIES, FILE_PURPOSES, FILE_REF_TYPES, FILE_SOURCES } from '@/lib/constants/file-util';
import { ORDER_ISSUE_STATUS } from '@/lib/constants/order-issues';
import { useHasPermissionCode } from '@/lib/hooks/usePermissions';
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
  const tCommon = useTranslations('common');
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
  const [search, setSearch] = React.useState('');
  const [page, setPage] = React.useState(1);
  const [pageSize, setPageSize] = React.useState<number>(CMX_DEFAULT_PAGE_SIZE);
  const [solveTarget, setSolveTarget] =
    React.useState<OrderIssueTableRow | null>(null);
  const [photosTarget, setPhotosTarget] =
    React.useState<OrderIssueTableRow | null>(null);
  const canResolveIssues = useHasPermissionCode('orders:update');
  const canReportIssues = useHasPermissionCode('orders:transition');

  const { data, isLoading, isFetching, isError, error, refetch } = useQuery({
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

  const issues = React.useMemo(() => {
    const sorted = sortOrderIssueRows(data ?? [], sortBy, sortDir);
    const term = search.trim().toLowerCase();
    if (!term) return sorted;
    return sorted.filter((row) => {
      const haystack = [
        row.order_no,
        row.issue_text,
        row.issue_type_name,
        row.issue_type_name2,
        row.issue_code,
        row.created_by_name,
        row.solved_notes,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return haystack.includes(term);
    });
  }, [data, search, sortBy, sortDir]);

  const openInView = issues.filter(
    (row) => row.status === ORDER_ISSUE_STATUS.OPEN
  ).length;

  const totalPages = Math.max(1, Math.ceil(issues.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const pagedIssues = React.useMemo(
    () => issues.slice((safePage - 1) * pageSize, safePage * pageSize),
    [issues, pageSize, safePage],
  );

  const columns = React.useMemo(
    () =>
      buildOrderIssueTableColumns({
        locale,
        t: (key, values) => t(key as never, values as never),
        includeOrderColumn: true,
        includeScopeColumn: true,
        onSolve: canResolveIssues ? (row) => setSolveTarget(row) : undefined,
        onPhotos: (row) => setPhotosTarget(row),
      }),
    [locale, t, canResolveIssues]
  );

  return (
    <div className="space-y-4 p-4 md:p-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">{t('pageTitle')}</h1>
          <p className="text-sm text-muted-foreground">{t('pageDescription')}</p>
        </div>
        <CmxButton
          type="button"
          variant="outline"
          size="sm"
          loading={isFetching}
          onClick={() => void refetch()}
        >
          {!isFetching ? <RefreshCw className="me-1.5 h-4 w-4" aria-hidden="true" /> : null}
          {tCommon('refresh')}
        </CmxButton>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {isLoading ? (
          <>
            <CmxSkeleton className="h-24 w-full" />
            <CmxSkeleton className="h-24 w-full" />
          </>
        ) : (
          <>
            <CmxKpiStatCard
              title={t('filterOpen')}
              value={openInView}
              tone={openInView > 0 ? 'danger' : 'default'}
            />
            <CmxKpiStatCard
              title={t('listTitle')}
              value={issues.length}
            />
          </>
        )}
      </div>

      <div className="space-y-3">
        <CmxInput
          type="search"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
          placeholder={tCommon('search')}
          aria-label={tCommon('search')}
          leftIcon={<Search className="h-4 w-4" aria-hidden="true" />}
        />

        <OrderIssuesFilterBar
          variant="queue"
          status={status}
          onStatusChange={(next) => {
            setStatus(next);
            setPage(1);
          }}
          scope={scope}
          onScopeChange={(value) => {
            setScope(value as OrderIssuesQueueScopeFilter);
            setPage(1);
          }}
          priority={priority}
          onPriorityChange={(next) => {
            setPriority(next);
            setPage(1);
          }}
          sortBy={sortBy}
          sortDir={sortDir}
          onSortByChange={setSortBy}
          onSortDirChange={setSortDir}
          onReset={() => {
            setStatus('open');
            setScope('all');
            setPriority('all');
            setSearch('');
            setSortBy(DEFAULT_ORDER_ISSUES_SORT_BY);
            setSortDir(DEFAULT_ORDER_ISSUES_SORT_DIR);
            setPage(1);
          }}
          openCount={openInView}
          totalCount={issues.length}
        />
      </div>

      <CmxCard>
        <CmxCardHeader>
          <CmxCardTitle>{t('listTitle')}</CmxCardTitle>
        </CmxCardHeader>
        <CmxCardContent>
          {isError ? (
            <div className="space-y-3">
              <CmxSummaryMessage
                type="error"
                title={t('listFailed')}
                items={[error instanceof Error ? error.message : t('listFailed')]}
              />
              <CmxButton
                type="button"
                variant="outline"
                size="sm"
                onClick={() => void refetch()}
              >
                {tCommon('retry')}
              </CmxButton>
            </div>
          ) : isLoading ? (
            <CmxSkeletonTable rows={6} columns={7} />
          ) : issues.length === 0 ? (
            <CmxEmptyState
              title={t('emptyTitle')}
              description={t('emptyDescription')}
            />
          ) : (
            <CmxDataTable
              columns={columns}
              data={pagedIssues}
              currentPage={safePage}
              pageSize={pageSize}
              totalCount={issues.length}
              onPageChange={setPage}
              onPageSizeChange={(nextSize) => {
                setPageSize(nextSize);
                setPage(1);
              }}
              showPageSizeSelector
              paginationFooter="always"
              emptyMessage={t('emptyTitle')}
            />
          )}
        </CmxCardContent>
      </CmxCard>

      {solveTarget && solveTarget.order_id ? (
        <OrderIssueSolveDialog
          open={Boolean(solveTarget)}
          orderId={solveTarget.order_id}
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

      <CmxDialog
        open={Boolean(photosTarget)}
        onOpenChange={(next) => {
          if (!next) setPhotosTarget(null);
        }}
      >
        <CmxDialogContent className="max-w-3xl">
          <CmxDialogHeader>
            <CmxDialogTitle>{t('photosTitle')}</CmxDialogTitle>
            <CmxDialogDescription className="line-clamp-2">
              {photosTarget?.issue_text}
            </CmxDialogDescription>
          </CmxDialogHeader>
          {photosTarget && photosTarget.order_id ? (
            <FileAttachments
              title={t('viewPhotos')}
              category={FILE_CATEGORIES.ORDER_FILE}
              entityId={photosTarget.order_id}
              purposes={[FILE_PURPOSES.ORDER_FILE.ISSUE_EVIDENCE]}
              refType={FILE_REF_TYPES.ORDER_ISSUE}
              refId={photosTarget.id}
              source={FILE_SOURCES.ORDER_ISSUE}
              readOnly={!canReportIssues}
            />
          ) : null}
          <CmxDialogFooter>
            <CmxButton
              type="button"
              variant="secondary"
              onClick={() => setPhotosTarget(null)}
            >
              {tCommon('close')}
            </CmxButton>
          </CmxDialogFooter>
        </CmxDialogContent>
      </CmxDialog>
    </div>
  );
}
