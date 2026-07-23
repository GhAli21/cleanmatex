/**
 * Tenant-wide order issues queue — CmxDataTable + status/scope/priority filters.
 */

'use client';

import * as React from 'react';
import Link from 'next/link';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocale, useTranslations } from 'next-intl';
import { CmxButton, CmxSpinner } from '@ui/primitives';
import { Badge } from '@ui/primitives/badge';
import { CmxEmptyState, CmxDataTable } from '@ui/data-display';
import {
  CmxCard,
  CmxCardContent,
  CmxCardHeader,
  CmxCardTitle,
} from '@ui/primitives/cmx-card';
import {
  ORDER_ISSUE_SCOPE,
  ORDER_ISSUE_STATUS,
  PRIORITY_CODES,
} from '@/lib/constants/order-issues';
import { OrderIssueSolveDialog } from './order-issue-solve-dialog';
import { OrderIssueActorTimeCell } from './order-issue-actor-time-cell';
import type { OrderIssueTableRow } from './order-issue-table-types';

type StatusFilter = 'open' | 'solved' | 'all';
type ScopeFilter = 'all' | 'ORDER' | 'ITEM' | 'PIECE';
type PriorityFilter = 'all' | (typeof PRIORITY_CODES)[number];

/**
 * Dashboard issues queue screen.
 */
export function OrdersIssuesQueuePage() {
  const t = useTranslations('orders.issues');
  const locale = useLocale();
  const queryClient = useQueryClient();
  const [status, setStatus] = React.useState<StatusFilter>('open');
  const [scope, setScope] = React.useState<ScopeFilter>('all');
  const [priority, setPriority] = React.useState<PriorityFilter>('all');
  const [solveTarget, setSolveTarget] = React.useState<{
    orderId: string;
    issueId: string;
  } | null>(null);

  const resetFilters = () => {
    setStatus('open');
    setScope('all');
    setPriority('all');
  };

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

  const issues = data ?? [];

  const typeLabel = (row: OrderIssueTableRow) => {
    if (locale === 'ar') {
      return row.issue_type_name2 || row.issue_type_name || row.issue_code;
    }
    return row.issue_type_name || row.issue_code;
  };

  const priorityLabel = (row: OrderIssueTableRow) => {
    if (locale === 'ar') {
      return row.priority_name2 || row.priority_name || row.priority || '—';
    }
    return row.priority_name || row.priority || '—';
  };

  const columns = React.useMemo(
    () => [
      {
        key: 'order',
        header: t('orderNo'),
        sortable: false,
        render: (row: OrderIssueTableRow) => (
          <Link
            href={`/dashboard/processing?orderId=${row.order_id}`}
            className="font-medium text-primary hover:underline"
          >
            {row.order_no ?? row.order_id?.slice(0, 8) ?? '—'}
          </Link>
        ),
      },
      {
        key: 'status',
        header: t('columns.status'),
        sortable: false,
        render: (row: OrderIssueTableRow) => {
          const isOpen =
            row.status === ORDER_ISSUE_STATUS.OPEN || !row.solved_at;
          return (
            <Badge variant={isOpen ? 'destructive' : 'success'}>
              {isOpen ? t('statusOpen') : t('statusSolved')}
            </Badge>
          );
        },
      },
      {
        key: 'issue',
        header: t('columns.issue'),
        sortable: false,
        render: (row: OrderIssueTableRow) => (
          <div className="min-w-[12rem] max-w-sm space-y-1">
            <Badge variant="outline">{typeLabel(row)}</Badge>
            <p className="text-sm font-medium whitespace-pre-wrap">
              {row.issue_text}
            </p>
          </div>
        ),
      },
      {
        key: 'priority',
        header: t('columns.priority'),
        sortable: false,
        render: (row: OrderIssueTableRow) => (
          <span
            className="text-sm font-medium"
            style={
              row.priority_color ? { color: row.priority_color } : undefined
            }
          >
            {priorityLabel(row)}
          </span>
        ),
      },
      {
        key: 'scope',
        header: t('columns.scope'),
        sortable: false,
        render: (row: OrderIssueTableRow) => (
          <span className="text-sm text-muted-foreground">
            {t(`scope.${String(row.scope_level || '').toLowerCase()}`)}
          </span>
        ),
      },
      {
        key: 'reported',
        header: t('columns.reported'),
        sortable: false,
        render: (row: OrderIssueTableRow) => (
          <OrderIssueActorTimeCell
            byLabel={t('createdBy')}
            whenLabel={t('createdWhen')}
            actorName={row.created_by_name}
            actorId={row.created_by}
            at={row.created_at}
            locale={locale}
          />
        ),
      },
      {
        key: 'resolution',
        header: t('columns.resolution'),
        sortable: false,
        render: (row: OrderIssueTableRow) => (
          <p className="max-w-xs text-sm whitespace-pre-wrap text-muted-foreground">
            {row.solved_notes?.trim() || '—'}
          </p>
        ),
      },
      {
        key: 'solved',
        header: t('columns.solved'),
        sortable: false,
        render: (row: OrderIssueTableRow) =>
          row.solved_at ? (
            <OrderIssueActorTimeCell
              byLabel={t('solvedBy')}
              whenLabel={t('solvedWhen')}
              actorName={row.solved_by_name}
              actorId={row.solved_by}
              at={row.solved_at}
              locale={locale}
            />
          ) : row.order_id ? (
            <CmxButton
              type="button"
              size="sm"
              variant="primary"
              onClick={() =>
                setSolveTarget({ orderId: row.order_id!, issueId: row.id })
              }
            >
              {t('solve')}
            </CmxButton>
          ) : (
            '—'
          ),
      },
    ],
    [locale, t]
  );

  const filterBtn = (
    active: boolean,
    label: string,
    onClick: () => void
  ) => (
    <CmxButton
      type="button"
      size="sm"
      variant={active ? 'primary' : 'secondary'}
      onClick={onClick}
    >
      {label}
    </CmxButton>
  );

  return (
    <div className="space-y-4 p-4 md:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">{t('pageTitle')}</h1>
          <p className="text-sm text-muted-foreground">{t('pageDescription')}</p>
        </div>
        <CmxButton type="button" size="sm" variant="ghost" onClick={resetFilters}>
          {t('filterReset')}
        </CmxButton>
      </div>

      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap gap-2">
          {filterBtn(status === 'open', t('filterOpen'), () => setStatus('open'))}
          {filterBtn(status === 'solved', t('filterSolved'), () =>
            setStatus('solved')
          )}
          {filterBtn(status === 'all', t('filterAll'), () => setStatus('all'))}
        </div>
        <div className="flex flex-wrap gap-2">
          {filterBtn(scope === 'all', t('filterScope.all'), () => setScope('all'))}
          {filterBtn(scope === ORDER_ISSUE_SCOPE.ORDER, t('filterScope.order'), () =>
            setScope(ORDER_ISSUE_SCOPE.ORDER)
          )}
          {filterBtn(scope === ORDER_ISSUE_SCOPE.ITEM, t('filterScope.item'), () =>
            setScope(ORDER_ISSUE_SCOPE.ITEM)
          )}
          {filterBtn(scope === ORDER_ISSUE_SCOPE.PIECE, t('filterScope.piece'), () =>
            setScope(ORDER_ISSUE_SCOPE.PIECE)
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          {filterBtn(priority === 'all', t('filterAll'), () =>
            setPriority('all')
          )}
          {PRIORITY_CODES.map((code) =>
            filterBtn(priority === code, t(`priorities.${code}`), () =>
              setPriority(code)
            )
          )}
        </div>
      </div>

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
          orderId={solveTarget.orderId}
          issueId={solveTarget.issueId}
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
