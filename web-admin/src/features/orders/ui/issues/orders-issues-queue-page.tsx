/**
 * Tenant-wide order issues queue — CmxDataTable layout.
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
import { OrderIssueSolveDialog } from './order-issue-solve-dialog';
import { OrderIssueActorTimeCell } from './order-issue-actor-time-cell';
import type { OrderIssueTableRow } from './order-issue-table-types';

/**
 * Dashboard issues queue screen.
 */
export function OrdersIssuesQueuePage() {
  const t = useTranslations('orders.issues');
  const locale = useLocale();
  const queryClient = useQueryClient();
  const [status, setStatus] = React.useState<'open' | 'all'>('open');
  const [solveTarget, setSolveTarget] = React.useState<{
    orderId: string;
    issueId: string;
  } | null>(null);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['tenant-order-issues', status],
    queryFn: async () => {
      const response = await fetch(
        `/api/v1/orders/issues?status=${status === 'open' ? 'open' : 'all'}`
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
        key: 'issue',
        header: t('columns.issue'),
        sortable: false,
        render: (row: OrderIssueTableRow) => {
          const isOpen = !row.solved_at;
          return (
            <div className="min-w-[12rem] max-w-sm space-y-1.5">
              <div className="flex flex-wrap items-center gap-1.5">
                <Badge variant={isOpen ? 'destructive' : 'success'}>
                  {isOpen ? t('statusOpen') : t('statusSolved')}
                </Badge>
                <Badge variant="outline">{t(`codes.${row.issue_code}`)}</Badge>
                {row.priority ? (
                  <span className="text-xs text-muted-foreground">
                    {t(`priorities.${row.priority}`)}
                  </span>
                ) : null}
              </div>
              <p className="text-sm font-medium whitespace-pre-wrap">
                {row.issue_text}
              </p>
            </div>
          );
        },
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

  return (
    <div className="space-y-4 p-4 md:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">{t('pageTitle')}</h1>
          <p className="text-sm text-muted-foreground">{t('pageDescription')}</p>
        </div>
        <div className="flex gap-2">
          <CmxButton
            type="button"
            size="sm"
            variant={status === 'open' ? 'primary' : 'secondary'}
            onClick={() => setStatus('open')}
          >
            {t('filterOpen')}
          </CmxButton>
          <CmxButton
            type="button"
            size="sm"
            variant={status === 'all' ? 'primary' : 'secondary'}
            onClick={() => setStatus('all')}
          >
            {t('filterAll')}
          </CmxButton>
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
